import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Activity, Assignment, Followup, Invite, Lead, Member, Organization, Payment, Photo, Role, PayMethod,
} from './types'
import { demoBackend } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** No Supabase keys configured → the app runs in demo mode with sample data. */
export const DEMO = !url || !key

export interface AuthUser { id: string; email: string }

export interface Backend {
  currentUser(): Promise<AuthUser | null>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  acceptInvites(): Promise<number>
  createOrganization(name: string, displayName: string): Promise<string>
  myMemberships(): Promise<(Member & { organization: Organization })[]>
  members(orgId: string): Promise<Member[]>
  updateMember(orgId: string, userId: string, patch: Partial<Member>): Promise<void>
  invites(orgId: string): Promise<Invite[]>
  invite(orgId: string, email: string, role: Role, name: string): Promise<void>
  deleteInvite(id: string): Promise<void>
  updateOrg(orgId: string, patch: Partial<Organization>): Promise<void>

  leads(orgId: string): Promise<Lead[]>
  createLead(lead: Partial<Lead> & { org_id: string; customer_name: string }): Promise<Lead>
  updateLead(id: string, patch: Partial<Lead>): Promise<void>
  deleteLead(id: string): Promise<void>

  followups(orgId: string): Promise<Followup[]>
  completeFollowup(id: string, outcome: string): Promise<void>
  addFollowup(f: { org_id: string; lead_id: string; label: string; due_on: string; assigned_to: string | null }): Promise<void>

  activities(leadId: string): Promise<Activity[]>
  addNote(orgId: string, leadId: string, body: string): Promise<void>

  photos(leadId: string): Promise<Photo[]>
  uploadPhoto(orgId: string, leadId: string, file: File, phase: string, caption: string): Promise<void>

  payments(orgId: string): Promise<Payment[]>
  addPayment(p: { org_id: string; lead_id: string; amount: number; method: PayMethod; received_on: string; note: string }): Promise<void>

  assignments(orgId: string): Promise<Assignment[]>
  assign(a: { org_id: string; lead_id: string; user_id: string; pay_amount: number | null }): Promise<void>
  unassign(leadId: string, userId: string): Promise<void>
  setPaidOut(leadId: string, userId: string, paid: boolean): Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function check(res: { data: any; error: { message: string } | null }): any {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

function supabaseBackend(sb: SupabaseClient): Backend {
  return {
    async currentUser() {
      // getSession reads the saved session on the device (no network round trip);
      // the database still verifies the token on every query.
      const { data } = await sb.auth.getSession()
      const u = data.session?.user
      return u ? { id: u.id, email: u.email ?? '' } : null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signUp(email, password) {
      const { error } = await sb.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
    },
    async signOut() { await sb.auth.signOut() },

    async acceptInvites() { return check(await sb.rpc('accept_invites')) as number },
    async createOrganization(name, displayName) {
      return check(await sb.rpc('create_organization', { p_name: name, p_display_name: displayName })) as string
    },
    async myMemberships() {
      const u = await this.currentUser()
      if (!u) return []
      return check(await sb.from('memberships').select('*, organization:organizations(*)')
        .eq('user_id', u.id).eq('active', true)) as never
    },
    async members(orgId) {
      return check(await sb.from('memberships').select('*').eq('org_id', orgId).order('display_name'))
    },
    async updateMember(orgId, userId, patch) {
      check(await sb.from('memberships').update(patch).eq('org_id', orgId).eq('user_id', userId))
    },
    async invites(orgId) {
      return check(await sb.from('invites').select('*').eq('org_id', orgId).order('created_at', { ascending: false }))
    },
    async invite(orgId, email, role, name) {
      check(await sb.from('invites').insert({ org_id: orgId, email: email.trim().toLowerCase(), role, display_name: name }))
    },
    async deleteInvite(id) { check(await sb.from('invites').delete().eq('id', id)) },
    async updateOrg(orgId, patch) { check(await sb.from('organizations').update(patch).eq('id', orgId)) },

    async leads(orgId) {
      return check(await sb.from('leads').select('*').eq('org_id', orgId).order('created_at', { ascending: false }))
    },
    async createLead(lead) { return check(await sb.from('leads').insert(lead).select().single()) },
    async updateLead(id, patch) { check(await sb.from('leads').update(patch).eq('id', id)) },
    async deleteLead(id) { check(await sb.from('leads').delete().eq('id', id)) },

    async followups(orgId) {
      return check(await sb.from('followups').select('*').eq('org_id', orgId).order('due_on'))
    },
    async completeFollowup(id, outcome) {
      const u = await this.currentUser()
      check(await sb.from('followups').update({ done_at: new Date().toISOString(), done_by: u?.id, outcome }).eq('id', id))
    },
    async addFollowup(f) { check(await sb.from('followups').insert(f)) },

    async activities(leadId) {
      return check(await sb.from('activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }))
    },
    async addNote(orgId, leadId, body) {
      check(await sb.from('activities').insert({ org_id: orgId, lead_id: leadId, kind: 'note', body }))
    },

    async photos(leadId) {
      const rows: Photo[] = check(await sb.from('photos').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }))
      if (!rows.length) return rows
      const { data } = await sb.storage.from('job-photos').createSignedUrls(rows.map(r => r.storage_path), 3600)
      return rows.map((r, i) => ({ ...r, url: data?.[i]?.signedUrl ?? undefined }))
    },
    async uploadPhoto(orgId, leadId, file, phase, caption) {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${orgId}/${leadId}/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('job-photos').upload(path, file, { contentType: file.type })
      if (error) throw new Error(error.message)
      check(await sb.from('photos').insert({ org_id: orgId, lead_id: leadId, storage_path: path, phase, caption: caption || null }))
    },

    async payments(orgId) {
      return check(await sb.from('payments').select('*').eq('org_id', orgId).order('received_on', { ascending: false }))
    },
    async addPayment(p) { check(await sb.from('payments').insert({ ...p, note: p.note || null })) },

    async assignments(orgId) { return check(await sb.from('job_assignments').select('*').eq('org_id', orgId)) },
    async assign(a) { check(await sb.from('job_assignments').upsert(a)) },
    async unassign(leadId, userId) {
      check(await sb.from('job_assignments').delete().eq('lead_id', leadId).eq('user_id', userId))
    },
    async setPaidOut(leadId, userId, paid) {
      check(await sb.from('job_assignments').update({ paid_out: paid }).eq('lead_id', leadId).eq('user_id', userId))
    },
  }
}

export const api: Backend = DEMO ? demoBackend() : supabaseBackend(createClient(url!, key!))
