// Demo backend: runs entirely in the browser with sample data so the app can be
// clicked through before Supabase is connected. Mirrors the database triggers.
import type { Backend } from './api'
import type {
  Activity, Assignment, Followup, Invite, Lead, Member, Organization, Payment, Photo, Stage,
} from './types'

interface DB {
  orgs: Organization[]; members: Member[]; invites: Invite[]; leads: Lead[]
  followups: Followup[]; activities: Activity[]; photos: Photo[]; payments: Payment[]
  assignments: Assignment[]; userId: string | null
}

const KEY = 'tradebase-demo-v2'
const uid = () => crypto.randomUUID()
const today = () => new Date().toISOString().slice(0, 10)
const addDays = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
const daysAgo = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString() }

const ORG = 'org-safehome'
const ME = 'u-jose', BARION = 'u-barion', LOGAN = 'u-logan', OFFICE = 'u-office', CREW = 'u-crew'

function seed(): DB {
  const db: DB = {
    orgs: [{ id: ORG, name: 'Safe Home Roofing', accent_color: '#1d4f91', followup_days: [1, 3, 7, 10, 14] }],
    members: [
      { org_id: ORG, user_id: ME, role: 'owner', display_name: 'Jose Pomavilla', phone: null, active: true },
      { org_id: ORG, user_id: BARION, role: 'rep', display_name: 'Barion', phone: null, active: true },
      { org_id: ORG, user_id: LOGAN, role: 'rep', display_name: 'Logan', phone: null, active: true },
      { org_id: ORG, user_id: OFFICE, role: 'office', display_name: 'Front office', phone: null, active: true },
      { org_id: ORG, user_id: CREW, role: 'crew', display_name: 'Crew A', phone: null, active: true },
    ],
    invites: [], leads: [], followups: [], activities: [], photos: [], payments: [], assignments: [],
    userId: null,
  }
  const mk = (name: string, addr: string, city: string, val: number, rep: string, stage: Stage, age: number, src: string) => {
    const l: Lead = {
      id: uid(), org_id: ORG, customer_name: name, phone: '(508) 555-01' + String(db.leads.length).padStart(2, '0'),
      email: null, address: addr, city, source: src, job_type: 'Roof replacement', stage,
      estimated_value: val, sold_value: null, assigned_rep: rep, appointment_at: null, scope_of_work: null,
      scope_warnings: null, lost_reason: null, notes: null, stage_changed_at: daysAgo(age), sold_at: null, created_at: daysAgo(age + 2),
    }
    db.leads.push(l)
    return l
  }
  mk('Olivia Bennett', '36 Birch Rd', 'Leominster, MA', 18500, BARION, 'new', 0, 'Website')
  mk('Thomas Walsh', '12 Pine Ave', 'Fitchburg, MA', 12800, LOGAN, 'new', 0, 'Google')
  mk('Michael Russo', '85 Main St', 'Lunenburg, MA', 24000, ME, 'contacted', 2, 'Referral')
  const sarah = mk('Sarah Mitchell', '18 Oak St', 'Nashua, NH', 21500, BARION, 'appointment', 1, 'Website')
  sarah.appointment_at = new Date(new Date().setHours(15, 30, 0, 0)).toISOString()
  const david = mk('David Kim', '91 Ash St', 'Worcester, MA', 19800, LOGAN, 'estimate_sent', 3, 'Door knock')
  const pat = mk('Patricia Hayes', '23 River Rd', 'Shrewsbury, MA', 11400, ME, 'estimate_sent', 8, 'Website')
  const james = mk('James O’Connor', '74 Elm St', 'Westminster, MA', 14600, LOGAN, 'sold', 2, 'Referral')
  james.sold_value = 14600; james.sold_at = daysAgo(2)
  const linda = mk('Linda Foster', '9 Cedar Ln', 'Princeton, MA', 16900, ME, 'in_progress', 1, 'Website')
  linda.sold_value = 16900; linda.sold_at = daysAgo(9)
  linda.scope_of_work = 'Full tear-off, GAF Timberline HDZ (Charcoal), ice & water shield on eaves and valleys, new ridge vent.'
  linda.scope_warnings = 'Do NOT strip the back porch roof — not in contract. Protect the garden beds on the south side.'
  const robert = mk('Robert Ellis', '42 Maple St', 'Lancaster, MA', 22300, BARION, 'paid', 5, 'Google')
  robert.sold_value = 22300; robert.sold_at = daysAgo(20)
  mk('Emily Parker', '7 Willow Ln', 'Bolton, MA', 9800, BARION, 'lost', 6, 'Website').lost_reason = 'Went with cheaper bid'

  for (const l of db.leads) {
    db.activities.push({ id: uid(), lead_id: l.id, author: null, kind: 'stage', body: 'Lead created', created_at: l.created_at })
    if (l.stage === 'new') fu(db, l, 'First call — reach out within 5 minutes', today())
  }
  fu(db, db.leads[2], 'Book inspection', addDays(-1))
  for (const d of [1, 3, 7, 10, 14]) fu(db, david, `Estimate follow-up — day ${d}`, addDays(d - 3), d < 3)
  for (const d of [1, 3, 7, 10, 14]) fu(db, pat, `Estimate follow-up — day ${d}`, addDays(d - 8), d < 7)
  fu(db, sarah, 'Confirm appointment', today())
  db.payments.push(
    { id: uid(), lead_id: james.id, amount: 5000, method: 'check', received_on: addDays(-2), note: 'Deposit', recorded_by: LOGAN },
    { id: uid(), lead_id: linda.id, amount: 8450, method: 'financing', received_on: addDays(-9), note: 'Deposit', recorded_by: ME },
    { id: uid(), lead_id: robert.id, amount: 22300, method: 'check', received_on: addDays(-5), note: 'Paid in full', recorded_by: BARION },
  )
  db.assignments.push({ lead_id: linda.id, user_id: CREW, org_id: ORG, pay_amount: 2400, paid_out: false })
  return db
}

function fu(db: DB, l: Lead, label: string, due: string, done = false) {
  db.followups.push({
    id: uid(), org_id: l.org_id, lead_id: l.id, label, due_on: due, assigned_to: l.assigned_rep,
    done_at: done ? new Date().toISOString() : null, done_by: done ? l.assigned_rep : null,
    outcome: done ? 'Left voicemail' : null, skipped: false,
  })
}

export function demoBackend(): Backend {
  let db: DB
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null') || seed() } catch { db = seed() }
  const listeners = new Set<() => void>()
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...db, photos: [] })) } catch { /* ignore */ } }
  const wait = () => new Promise(r => setTimeout(r, 60))
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
  const log = (lead: Lead, kind: string, body: string) =>
    db.activities.push({ id: uid(), lead_id: lead.id, author: db.userId, kind, body, created_at: new Date().toISOString() })

  return {
    async currentUser() { return db.userId ? { id: db.userId, email: 'jose@safehomeroofs.com' } : null },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async signIn() { await wait(); db.userId = ME; save(); listeners.forEach(f => f()) },
    async signUp() { await wait(); db.userId = ME; save(); listeners.forEach(f => f()) },
    async signOut() { db.userId = null; save(); listeners.forEach(f => f()) },

    async acceptInvites() { return 0 },
    async createOrganization() { return ORG },
    async myMemberships() {
      return db.members.filter(m => m.user_id === db.userId)
        .map(m => ({ ...m, organization: db.orgs.find(o => o.id === m.org_id)! }))
    },
    async members(orgId) { return clone(db.members.filter(m => m.org_id === orgId)) },
    async updateMember(orgId, userId, patch) {
      Object.assign(db.members.find(m => m.org_id === orgId && m.user_id === userId)!, patch); save()
    },
    async invites(orgId) { return clone(db.invites.filter(i => i.org_id === orgId)) },
    async invite(orgId, email, role, name) {
      db.invites.unshift({ id: uid(), org_id: orgId, email, role, display_name: name, accepted_at: null }); save()
      return { status: 'sent' as const }
    },
    async sendPasswordReset() { await wait() },
    async setPassword() { await wait() },
    async ready() {},
    async deleteInvite(id) { db.invites = db.invites.filter(i => i.id !== id); save() },
    async updateOrg(orgId, patch) { Object.assign(db.orgs.find(o => o.id === orgId)!, patch); save() },

    async leads(orgId) { await wait(); return clone(db.leads.filter(l => l.org_id === orgId)) },
    async createLead(input) {
      const l: Lead = {
        phone: null, email: null, address: null, city: null, source: null, job_type: 'Roof replacement',
        stage: 'new', estimated_value: null, sold_value: null, assigned_rep: null, appointment_at: null,
        scope_of_work: null, scope_warnings: null, lost_reason: null, notes: null, sold_at: null,
        ...input, id: uid(), stage_changed_at: new Date().toISOString(), created_at: new Date().toISOString(),
      } as Lead
      db.leads.unshift(l)
      fu(db, l, 'First call — reach out within 5 minutes', today())
      log(l, 'stage', 'Lead created')
      save(); return clone(l)
    },
    async updateLead(id, patch) {
      const l = db.leads.find(x => x.id === id)!
      const old = { ...l }
      Object.assign(l, patch)
      if (patch.stage && patch.stage !== old.stage) {
        l.stage_changed_at = new Date().toISOString()
        log(l, 'stage', `Moved from ${old.stage} to ${l.stage}`)
        if (l.stage === 'sold' && !l.sold_at) { l.sold_at = new Date().toISOString(); l.sold_value ??= l.estimated_value }
        if (l.stage === 'estimate_sent')
          for (const d of db.orgs.find(o => o.id === l.org_id)!.followup_days) fu(db, l, `Estimate follow-up — day ${d}`, addDays(d))
        if (l.stage === 'appointment' && l.appointment_at) {
          const d = new Date(l.appointment_at); d.setDate(d.getDate() - 1)
          fu(db, l, 'Confirm appointment', d.toISOString().slice(0, 10))
        }
        if (l.stage === 'sold' || l.stage === 'lost')
          db.followups.filter(f => f.lead_id === id && !f.done_at).forEach(f => { f.skipped = true })
      }
      if ('assigned_rep' in patch && patch.assigned_rep !== old.assigned_rep)
        db.followups.filter(f => f.lead_id === id && !f.done_at && !f.skipped).forEach(f => { f.assigned_to = l.assigned_rep })
      save()
    },
    async deleteLead(id) { db.leads = db.leads.filter(l => l.id !== id); save() },

    async followups(orgId) { return clone(db.followups.filter(f => f.org_id === orgId)) },
    async completeFollowup(id, outcome) {
      const f = db.followups.find(x => x.id === id)!
      f.done_at = new Date().toISOString(); f.done_by = db.userId; f.outcome = outcome; save()
    },
    async addFollowup(f) { db.followups.push({ ...f, id: uid(), done_at: null, done_by: null, outcome: null, skipped: false }); save() },

    async activities(leadId) {
      return clone(db.activities.filter(a => a.lead_id === leadId)).sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    async addNote(_orgId, leadId, body) {
      db.activities.push({ id: uid(), lead_id: leadId, author: db.userId, kind: 'note', body, created_at: new Date().toISOString() }); save()
    },

    async photos(leadId) { return db.photos.filter(p => p.lead_id === leadId) },
    async uploadPhoto(_orgId, leadId, file, phase, caption) {
      db.photos.unshift({
        id: uid(), lead_id: leadId, storage_path: file.name, caption: caption || null, phase,
        uploaded_by: db.userId, created_at: new Date().toISOString(), url: URL.createObjectURL(file),
      })
    },

    async payments(orgId) {
      const ids = new Set(db.leads.filter(l => l.org_id === orgId).map(l => l.id))
      return clone(db.payments.filter(p => ids.has(p.lead_id)))
    },
    async addPayment(p) {
      db.payments.push({ id: uid(), lead_id: p.lead_id, amount: p.amount, method: p.method, received_on: p.received_on, note: p.note || null, recorded_by: db.userId })
      const l = db.leads.find(x => x.id === p.lead_id)!
      log(l, 'payment', `Payment recorded: $${p.amount.toLocaleString()} (${p.method})`)
      save()
    },

    async assignments(orgId) { return clone(db.assignments.filter(a => a.org_id === orgId)) },
    async assign(a) {
      db.assignments = db.assignments.filter(x => !(x.lead_id === a.lead_id && x.user_id === a.user_id))
      db.assignments.push({ ...a, paid_out: false }); save()
    },
    async unassign(leadId, userId) {
      db.assignments = db.assignments.filter(x => !(x.lead_id === leadId && x.user_id === userId)); save()
    },
    async setPaidOut(leadId, userId, paid) {
      const a = db.assignments.find(x => x.lead_id === leadId && x.user_id === userId); if (a) a.paid_out = paid; save()
    },
  }
}
