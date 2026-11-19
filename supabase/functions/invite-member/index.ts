// invite-member: an owner/office user invites someone to their company.
// Saves the invite (so the person lands in the right company with the right role)
// and sends a Supabase invite email with a link to set their password.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ROLES = ['owner', 'office', 'rep', 'crew']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { persistSession: false } })

  // who is asking?
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who } = await admin.auth.getUser(token)
  if (!who?.user) return json({ error: 'Not signed in' }, 401)

  let body: { org_id?: string; email?: string; role?: string; display_name?: string; redirect_to?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const email = (body.email ?? '').trim().toLowerCase()
  const role = body.role ?? 'rep'
  const name = (body.display_name ?? '').trim()
  if (!body.org_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role) || !name)
    return json({ error: 'Name, a valid email and a role are required' }, 400)

  // only owners and office staff of THIS company may invite; only owners may invite owners
  const { data: me } = await admin.from('memberships').select('role')
    .eq('org_id', body.org_id).eq('user_id', who.user.id).eq('active', true).maybeSingle()
  if (!me || !['owner', 'office'].includes(me.role)) return json({ error: 'Only owners and office staff can invite' }, 403)
  if (role === 'owner' && me.role !== 'owner') return json({ error: 'Only an owner can invite another owner' }, 403)

  const { data: org } = await admin.from('organizations').select('name').eq('id', body.org_id).single()

  const { error: invErr } = await admin.from('invites').upsert(
    { org_id: body.org_id, email, role, display_name: name, invited_by: who.user.id, accepted_at: null },
    { onConflict: 'org_id,email' })
  if (invErr) return json({ error: invErr.message }, 500)

  // already has an account? they just join the company next time they sign in
  const { data: existing } = await admin.rpc('crm_user_exists', { p_email: email })
  if (existing) return json({ status: 'existing' })

  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: body.redirect_to,
    data: { display_name: name, company: org?.name ?? '' },
  })
  if (mailErr) return json({ status: 'saved', email_error: mailErr.message })
  return json({ status: 'sent' })
})
