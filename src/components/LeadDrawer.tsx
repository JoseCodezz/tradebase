import { useEffect, useState } from 'react'
import { AlertTriangle, Camera, MapPin, Phone, Mail, X, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useStore, money, todayISO } from '../lib/store'
import { STAGES, WON_STAGES, type Activity, type Lead, type PayMethod, type Photo, type Stage } from '../lib/types'
import FollowupItem from './FollowupItem'
import { JOB_TYPES, SOURCES } from './AddLead'
import LostReason from './LostReason'

type Tab = 'overview' | 'followups' | 'activity' | 'photos' | 'money' | 'crew'

export default function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { leads, me, can, refresh } = useStore()
  const lead = leads.find(l => l.id === id)
  const crew = me?.role === 'crew'
  const [tab, setTab] = useState<Tab>(crew ? 'crew' : 'overview')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!lead) return null
  const tabs: [Tab, string][] = crew
    ? [['crew', 'Scope of work'], ['photos', 'Photos']]
    : [['overview', 'Overview'], ['followups', 'Follow-ups'], ['activity', 'Notes'], ['photos', 'Photos'], ['money', 'Payments'], ['crew', 'Crew & scope']]

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="row between">
            <div className="tiny">{lead.job_type}</div>
            <div className="row" style={{ gap: 4 }}>
              {can('owner', 'office') && (confirmDel ? (
                <>
                  <span className="small accent">Delete for good?</span>
                  <button className="btn sm primary" onClick={async () => { await api.deleteLead(lead.id); onClose(); await refresh() }}>Delete</button>
                  <button className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button>
                </>
              ) : (
                <button className="btn ghost sm" title="Delete lead" onClick={() => setConfirmDel(true)}><Trash2 size={15} /></button>
              ))}
              <button className="btn ghost sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
          </div>
          <h1 className="serif" style={{ fontSize: 26, marginTop: 4 }}>{lead.customer_name}</h1>
          <div className="row wrap small muted" style={{ marginTop: 6, gap: 14 }}>
            {lead.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(`${lead.address} ${lead.city ?? ''}`)}`} target="_blank" className="row" style={{ gap: 4 }}><MapPin size={13} />{lead.address}{lead.city ? `, ${lead.city}` : ''}</a>}
            {!crew && lead.phone && <a href={`tel:${lead.phone}`} className="row accent" style={{ gap: 4 }}><Phone size={13} />{lead.phone}</a>}
            {!crew && lead.email && <a href={`mailto:${lead.email}`} className="row" style={{ gap: 4 }}><Mail size={13} />{lead.email}</a>}
          </div>
          <div className="tabs">
            {tabs.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
          </div>
        </div>
        <div className="drawer-body">
          {tab === 'overview' && <Overview lead={lead} />}
          {tab === 'followups' && <Followups lead={lead} />}
          {tab === 'activity' && <Notes lead={lead} />}
          {tab === 'photos' && <Photos lead={lead} />}
          {tab === 'money' && <Money lead={lead} />}
          {tab === 'crew' && <Crew lead={lead} />}
        </div>
      </div>
    </div>
  )
}

function Overview({ lead }: { lead: Lead }) {
  const { members, refresh } = useStore()
  const [f, setF] = useState(lead)
  const [saved, setSaved] = useState(false)
  useEffect(() => setF(lead), [lead])
  const set = (k: keyof Lead) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }
  const idx = STAGES.findIndex(s => s.id === lead.stage)

  const [losing, setLosing] = useState(false)
  async function changeStage(stage: Stage, lost_reason?: string) {
    if (stage === 'lost' && lost_reason === undefined) { setLosing(true); return }
    await api.updateLead(lead.id, stage === 'lost' ? { stage, lost_reason } : { stage }); await refresh()
  }

  async function save() {
    const num = (v: unknown) => v === '' || v == null ? null : Number(String(v).replace(/[^0-9.]/g, ''))
    await api.updateLead(lead.id, {
      customer_name: f.customer_name, phone: f.phone || null, email: f.email || null,
      address: f.address || null, city: f.city || null, source: f.source, job_type: f.job_type,
      estimated_value: num(f.estimated_value), sold_value: num(f.sold_value),
      assigned_rep: f.assigned_rep || null, notes: f.notes || null,
      appointment_at: f.appointment_at ? new Date(f.appointment_at).toISOString() : null,
    })
    await refresh(); setSaved(true)
  }

  const localDT = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <>
      <div className="card pad stack">
        <div className="tiny">Stage</div>
        <div className="stage-steps">
          {STAGES.map((s, i) => (
            <button key={s.id} onClick={() => changeStage(s.id)}
              className={s.id === lead.stage ? 'on' : (lead.stage !== 'lost' && s.id !== 'lost' && i < idx ? 'done' : '')}>
              {s.label}
            </button>
          ))}
        </div>
        {lead.stage === 'lost' && lead.lost_reason && <div className="small muted">Lost because: {lead.lost_reason}</div>}
        {lead.stage === 'appointment' && !lead.appointment_at && <div className="pill amber">Set the appointment time below so it shows on Today.</div>}
      </div>
      {losing && <LostReason name={lead.customer_name} onCancel={() => setLosing(false)} onConfirm={r => { setLosing(false); changeStage('lost', r) }} />}

      <div className="card pad stack">
        <div className="grid2">
          <label className="field">Customer name<input className="input" value={f.customer_name} onChange={set('customer_name')} /></label>
          <label className="field">Assigned rep
            <select className="input" value={f.assigned_rep ?? ''} onChange={set('assigned_rep')}>
              <option value="">Unassigned</option>
              {members.filter(m => m.role !== 'crew').map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
            </select>
          </label>
          <label className="field">Phone<input className="input" value={f.phone ?? ''} onChange={set('phone')} /></label>
          <label className="field">Email<input className="input" value={f.email ?? ''} onChange={set('email')} /></label>
          <label className="field">Street address<input className="input" value={f.address ?? ''} onChange={set('address')} /></label>
          <label className="field">City, state<input className="input" value={f.city ?? ''} onChange={set('city')} /></label>
          <label className="field">Job type<select className="input" value={f.job_type} onChange={set('job_type')}>{JOB_TYPES.map(j => <option key={j}>{j}</option>)}</select></label>
          <label className="field">Lead source<select className="input" value={f.source ?? ''} onChange={set('source')}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Estimated value ($)<input className="input" value={f.estimated_value ?? ''} onChange={set('estimated_value')} /></label>
          <label className="field">Sold for ($)<input className="input" value={f.sold_value ?? ''} onChange={set('sold_value')} placeholder="When signed" /></label>
          <label className="field">Appointment<input className="input" type="datetime-local" value={localDT(f.appointment_at)} onChange={set('appointment_at')} /></label>
        </div>
        <label className="field">Notes<textarea className="input" value={f.notes ?? ''} onChange={set('notes')} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {saved && <span className="pill green">Saved</span>}
          <button className="btn primary" onClick={save}>Save changes</button>
        </div>
      </div>
    </>
  )
}

function Followups({ lead }: { lead: Lead }) {
  const { followups, org, refresh } = useStore()
  const [label, setLabel] = useState('')
  const [due, setDue] = useState(todayISO())
  const list = followups.filter(f => f.lead_id === lead.id).sort((a, b) => a.due_on.localeCompare(b.due_on))
  const done = list.filter(f => f.done_at).length

  async function add() {
    if (!label.trim()) return
    await api.addFollowup({ org_id: org!.id, lead_id: lead.id, label: label.trim(), due_on: due, assigned_to: lead.assigned_rep })
    setLabel(''); await refresh()
  }

  return (
    <>
      <div className="card pad">
        <div className="section-title"><h2>Follow-up checklist</h2><span className="small muted">{done} of {list.length} done</span></div>
        {list.length > 0 && <div className="progress" style={{ margin: '6px 0 10px' }}><div style={{ width: `${(done / list.length) * 100}%` }} /></div>}
        {list.length === 0 ? <div className="empty small">No follow-ups yet.</div> : list.map(f => <FollowupItem key={f.id} f={f} showLead={false} />)}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Moving this lead to <b>Estimate sent</b> adds follow-ups on days {org?.followup_days.join(', ')}. They close out automatically once it's sold or lost.
        </p>
      </div>
      <div className="card pad stack">
        <div className="tiny">Add a follow-up</div>
        <div className="row wrap">
          <input className="input grow" placeholder="e.g. Send shingle color options" value={label} onChange={e => setLabel(e.target.value)} />
          <input className="input" type="date" style={{ width: 'auto' }} value={due} onChange={e => setDue(e.target.value)} />
          <button className="btn primary" onClick={add}>Add</button>
        </div>
      </div>
    </>
  )
}

function Notes({ lead }: { lead: Lead }) {
  const { org, memberName } = useStore()
  const [items, setItems] = useState<Activity[]>([])
  const [body, setBody] = useState('')
  const load = () => api.activities(lead.id).then(setItems)
  useEffect(() => { load() }, [lead.id, lead.stage]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!body.trim()) return
    await api.addNote(org!.id, lead.id, body.trim()); setBody(''); load()
  }
  return (
    <div className="card pad stack">
      <textarea className="input" placeholder="Add a note: what the homeowner said, objections, next steps…" value={body} onChange={e => setBody(e.target.value)} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={add}>Add note</button></div>
      <div>
        {items.map(a => (
          <div key={a.id} className={'timeline-item ' + a.kind}>
            <span className="dot" />
            <div className="grow">
              <div style={a.kind === 'note' ? {} : { color: 'var(--muted)' }}>{a.body}</div>
              <div className="small muted">{a.author ? memberName(a.author) + ' · ' : ''}{new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Photos({ lead }: { lead: Lead }) {
  const { org, memberName } = useStore()
  const [items, setItems] = useState<Photo[]>([])
  const [phase, setPhase] = useState('before')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = () => api.photos(lead.id).then(setItems)
  useEffect(() => { load() }, [lead.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true); setErr('')
    try { for (const f of Array.from(files)) await api.uploadPhoto(org!.id, lead.id, f, phase, '') }
    catch (e) { setErr((e as Error).message) }
    setBusy(false); load()
  }

  return (
    <div className="card pad stack">
      <div className="row wrap">
        <select className="input" style={{ width: 'auto' }} value={phase} onChange={e => setPhase(e.target.value)}>
          <option value="before">Before</option><option value="damage">Damage</option>
          <option value="during">During work</option><option value="after">After / finished</option>
        </select>
        <label className="btn primary" style={{ cursor: 'pointer' }}>
          <Camera size={16} />{busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple capture="environment" hidden onChange={e => upload(e.target.files)} />
        </label>
      </div>
      {err && <div className="error">{err}</div>}
      {items.length === 0 ? <div className="empty small">No photos yet. Reps and crew can both add photos from their phones.</div> : (
        <div className="photos">
          {items.map(p => (
            <figure key={p.id}>
              {p.url ? <a href={p.url} target="_blank"><img src={p.url} alt={p.caption ?? p.phase} /></a> : <div style={{ aspectRatio: '4/3' }} />}
              <figcaption><b style={{ textTransform: 'capitalize' }}>{p.phase}</b> · {memberName(p.uploaded_by)}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

const METHODS: PayMethod[] = ['check', 'cash', 'card', 'financing', 'insurance', 'other']

function Money({ lead }: { lead: Lead }) {
  const { org, payments, refresh, memberName } = useStore()
  const list = payments.filter(p => p.lead_id === lead.id)
  const collected = list.reduce((s, p) => s + p.amount, 0)
  const contract = lead.sold_value ?? lead.estimated_value ?? 0
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('check')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')

  async function add() {
    const n = Number(amount.replace(/[^0-9.]/g, ''))
    if (!n) return
    await api.addPayment({ org_id: org!.id, lead_id: lead.id, amount: n, method, received_on: date, note })
    setAmount(''); setNote(''); await refresh()
  }

  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 0 }}>
        <div className="card pad kpi"><div className="tiny">{WON_STAGES.includes(lead.stage) ? 'Contract' : 'Estimate'}</div><div className="num" style={{ fontSize: 22 }}>{money(contract)}</div></div>
        <div className="card pad kpi"><div className="tiny">Collected</div><div className="num" style={{ fontSize: 22, color: 'var(--ok)' }}>{money(collected)}</div></div>
        <div className="card pad kpi"><div className="tiny">Balance</div><div className="num" style={{ fontSize: 22 }}>{money(Math.max(0, contract - collected))}</div></div>
      </div>
      <div className="card pad stack">
        <div className="tiny">Record a payment</div>
        <div className="grid2">
          <input className="input" inputMode="decimal" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="input" value={method} onChange={e => setMethod(e.target.value as PayMethod)}>{METHODS.map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m}</option>)}</select>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input className="input" placeholder="Note (deposit, final, check #…)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={add}>Record payment</button></div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Method</th><th>Note</th><th>By</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="empty small">No payments yet.</td></tr>}
            {list.map(p => (
              <tr key={p.id}>
                <td>{new Date(p.received_on + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                <td style={{ textTransform: 'capitalize' }}>{p.method}</td>
                <td className="muted">{p.note}</td>
                <td className="muted">{memberName(p.recorded_by)}</td>
                <td className="num">{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Crew({ lead }: { lead: Lead }) {
  const { members, assignments, org, refresh, can, memberName } = useStore()
  const admin = can('owner', 'office')
  const staff = can('owner', 'office', 'rep')
  const crewMembers = members.filter(m => m.role === 'crew' || m.role === 'rep')
  const onJob = assignments.filter(a => a.lead_id === lead.id)
  const [scope, setScope] = useState(lead.scope_of_work ?? '')
  const [warn, setWarn] = useState(lead.scope_warnings ?? '')
  const [who, setWho] = useState('')
  const [pay, setPay] = useState('')
  const [saved, setSaved] = useState(false)

  async function saveScope() {
    await api.updateLead(lead.id, { scope_of_work: scope || null, scope_warnings: warn || null })
    await refresh(); setSaved(true)
  }
  async function add() {
    if (!who) return
    await api.assign({ org_id: org!.id, lead_id: lead.id, user_id: who, pay_amount: pay ? Number(pay.replace(/[^0-9.]/g, '')) : null })
    setWho(''); setPay(''); await refresh()
  }

  return (
    <>
      {lead.scope_warnings && (
        <div className="warn-box"><AlertTriangle size={18} style={{ flexShrink: 0 }} /><div><b>Do not:</b> {lead.scope_warnings}</div></div>
      )}
      <div className="card pad stack">
        <div className="tiny">Scope of work</div>
        {staff ? (
          <>
            <textarea className="input" rows={4} value={scope} onChange={e => { setScope(e.target.value); setSaved(false) }} placeholder="Exactly what the crew is doing: tear-off, shingle line & color, ice & water, flashing, ridge vent…" />
            <div className="tiny">What the crew must NOT do</div>
            <textarea className="input" rows={2} value={warn} onChange={e => { setWarn(e.target.value); setSaved(false) }} placeholder="e.g. Don't strip the garage roof — not in contract" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>{saved && <span className="pill green">Saved</span>}<button className="btn primary" onClick={saveScope}>Save scope</button></div>
          </>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{lead.scope_of_work || 'No scope written yet — ask the office before starting.'}</div>
        )}
      </div>

      {staff && (
        <div className="card pad stack">
          <div className="tiny">Who's on this job</div>
          {onJob.length === 0 && <div className="small muted">Nobody assigned yet.</div>}
          {onJob.map(a => (
            <div key={a.user_id} className="fu-row">
              <div className="grow">{memberName(a.user_id)}<div className="small muted">Owed {money(a.pay_amount)}</div></div>
              {admin ? (
                <>
                  <button className={'btn sm ' + (a.paid_out ? 'soft' : '')} onClick={async () => { await api.setPaidOut(lead.id, a.user_id, !a.paid_out); refresh() }}>
                    {a.paid_out ? 'Paid out ✓' : 'Mark paid out'}
                  </button>
                  <button className="btn ghost sm" onClick={async () => { await api.unassign(lead.id, a.user_id); refresh() }}><X size={14} /></button>
                </>
              ) : <span className={'pill ' + (a.paid_out ? 'green' : '')}>{a.paid_out ? 'Paid out' : 'Not paid yet'}</span>}
            </div>
          ))}
          {admin && (
            <div className="row wrap">
              <select className="input grow" value={who} onChange={e => setWho(e.target.value)}>
                <option value="">Assign crew member…</option>
                {crewMembers.filter(m => !onJob.some(a => a.user_id === m.user_id)).map(m => <option key={m.user_id} value={m.user_id}>{m.display_name} ({m.role})</option>)}
              </select>
              <input className="input" style={{ width: 130 }} placeholder="Pay ($)" value={pay} onChange={e => setPay(e.target.value)} />
              <button className="btn primary" onClick={add}>Assign</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
