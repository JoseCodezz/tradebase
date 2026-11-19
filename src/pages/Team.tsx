import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useStore, money, todayISO } from '../lib/store'
import { WON_STAGES, type Invite, type Role } from '../lib/types'

const PERIODS = [
  { id: 'month', label: 'This month', days: 0 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: 99999 },
]

export default function Team() {
  const { leads, payments, followups, members, org, can, refresh, reloadSession } = useStore()
  const [period, setPeriod] = useState('month')
  const t = todayISO()
  const p = PERIODS.find(x => x.id === period)!
  const since = p.id === 'month' ? t.slice(0, 7) + '-01' : new Date(Date.now() - p.days * 86400000).toISOString().slice(0, 10)
  const inPeriod = leads.filter(l => l.created_at.slice(0, 10) >= since)

  const reps = members.filter(m => m.role !== 'crew')
  const stats = [...reps.map(m => m.user_id), null].map(uid => {
    const mine = inPeriod.filter(l => l.assigned_rep === uid)
    const won = mine.filter(l => WON_STAGES.includes(l.stage))
    const lost = mine.filter(l => l.stage === 'lost')
    const estimates = mine.filter(l => l.stage === 'estimate_sent' || WON_STAGES.includes(l.stage) || (l.stage === 'lost' && l.estimated_value))
    const ids = new Set(leads.filter(l => l.assigned_rep === uid).map(l => l.id))
    const cash = payments.filter(x => ids.has(x.lead_id) && x.received_on >= since).reduce((s, x) => s + x.amount, 0)
    const overdue = followups.filter(f => f.assigned_to === uid && !f.done_at && !f.skipped && f.due_on < t).length
    return {
      uid, name: uid ? members.find(m => m.user_id === uid)!.display_name : 'Unassigned',
      leads: mine.length, estimates: estimates.length, won: won.length,
      closeRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
      sold: won.reduce((s, l) => s + (l.sold_value ?? l.estimated_value ?? 0), 0), cash, overdue,
    }
  }).filter(s => s.uid || s.leads)

  const tot = stats.reduce((a, s) => ({ leads: a.leads + s.leads, won: a.won + s.won, sold: a.sold + s.sold, cash: a.cash + s.cash }), { leads: 0, won: 0, sold: 0, cash: 0 })
  const sources = Object.entries(inPeriod.reduce<Record<string, { n: number; won: number }>>((acc, l) => {
    const k = l.source || 'Unknown'; acc[k] ??= { n: 0, won: 0 }; acc[k].n++; if (WON_STAGES.includes(l.stage)) acc[k].won++; return acc
  }, {})).sort((a, b) => b[1].n - a[1].n)

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Team & stats</h1><p>Who's closing, who's behind, and where the leads come from.</p></div>
        <div className="journey" style={{ margin: 0 }}>
          {PERIODS.map(x => <button key={x.id} className={period === x.id ? 'on' : ''} onClick={() => setPeriod(x.id)}>{x.label}</button>)}
        </div>
      </div>

      <div className="kpis">
        <div className="card pad kpi"><div className="num">{tot.leads}</div><div>Leads</div></div>
        <div className="card pad kpi"><div className="num">{tot.leads ? Math.round((tot.won / tot.leads) * 100) : 0}%</div><div>Lead → sold</div><div className="small muted">{tot.won} jobs sold</div></div>
        <div className="card pad kpi"><div className="num">{money(tot.sold)}</div><div>Sold</div></div>
        <div className="card pad kpi"><div className="num">{money(tot.cash)}</div><div>Collected</div></div>
      </div>

      <div className="card" style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table className="tbl">
          <thead><tr><th>Rep</th><th className="num">Leads</th><th className="num">Estimates</th><th className="num">Sold</th><th className="num">Close rate</th><th className="num">Revenue sold</th><th className="num">Collected</th><th className="num">Overdue</th></tr></thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.uid ?? 'none'}>
                <td><b style={{ fontWeight: 500 }}>{s.name}</b></td>
                <td className="num">{s.leads}</td><td className="num">{s.estimates}</td><td className="num">{s.won}</td>
                <td className="num">{s.closeRate == null ? '—' : s.closeRate + '%'}</td>
                <td className="num">{money(s.sold)}</td><td className="num">{money(s.cash)}</td>
                <td className="num">{s.overdue ? <span className="pill red">{s.overdue}</span> : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: -8 }}>Close rate = sold ÷ (sold + lost) for leads created in the period.</p>

      <div className="two-col">
        <div className="card pad">
          <div className="section-title"><h2>Lead sources</h2></div>
          {sources.length === 0 ? <div className="empty small">No leads in this period.</div> : (
            <table className="tbl"><thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Sold</th><th className="num">Rate</th></tr></thead>
              <tbody>{sources.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v.n}</td><td className="num">{v.won}</td><td className="num">{Math.round((v.won / v.n) * 100)}%</td></tr>)}</tbody>
            </table>
          )}
        </div>
        {can('owner', 'office') && <People orgId={org!.id} onChange={async () => { await refresh(); await reloadSession() }} />}
      </div>
    </div>
  )
}

function People({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const { members, me, org } = useStore()
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('rep')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [cadence, setCadence] = useState(org?.followup_days.join(', ') ?? '')
  const [color, setColor] = useState(org?.accent_color ?? '#b64d26')
  const load = () => api.invites(orgId).then(setInvites)
  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: FormEvent) {
    e.preventDefault(); setErr('')
    setSending(true); setNote('')
    try {
      const sent = email.trim().toLowerCase()
      const r = await api.invite(orgId, sent, role, name)
      setNote(r.status === 'sent' ? `Invite email sent to ${sent}.`
        : r.status === 'existing' ? `${sent} already has an account. They'll see ${org?.name} next time they sign in.`
        : `Invite saved, but the email didn't send (${r.email_error}). Use "Share invite" below to text it instead.`)
      setEmail(''); setName(''); load()
    }
    catch (e) { setErr((e as Error).message) }
    setSending(false)
  }

  return (
    <div className="card pad stack">
      <div className="section-title"><h2>People</h2></div>
      {members.map(m => (
        <div key={m.user_id} className="fu-row">
          <div className="grow">{m.display_name}{!m.active && <span className="pill" style={{ marginLeft: 6 }}>Inactive</span>}</div>
          <select className="input" style={{ width: 'auto' }} value={m.role} disabled={m.user_id === me?.user_id}
            onChange={async e => { await api.updateMember(orgId, m.user_id, { role: e.target.value as Role }); onChange() }}>
            <option value="owner">Owner</option><option value="office">Office</option><option value="rep">Sales rep</option><option value="crew">Crew</option>
          </select>
        </div>
      ))}
      <form onSubmit={invite} className="stack" style={{ borderTop: '1px solid var(--col)', paddingTop: 12 }}>
        <div className="tiny">Invite someone</div>
        <div className="grid2">
          <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="row">
          <select className="input grow" value={role} onChange={e => setRole(e.target.value as Role)}>
            <option value="rep">Sales rep — sees all leads, logs follow-ups & payments</option>
            <option value="office">Office — everything except company settings</option>
            <option value="crew">Crew — only jobs assigned to them, scope & photos</option>
            <option value="owner">Owner — full access</option>
          </select>
          <button className="btn primary" disabled={sending}>{sending ? 'Sending…' : 'Send invite'}</button>
        </div>
        {err && <div className="error">{err}</div>}
        {note && <div className="small" style={{ color: note.startsWith('Invite saved') ? 'var(--warn)' : 'var(--ok)' }}>{note}</div>}
        <p className="small muted" style={{ margin: 0 }}>They get an email with a link to set their password and land straight in {org?.name}. You can also text them the invite with <b>Share invite</b>.</p>
      </form>
      {invites.filter(i => !i.accepted_at).map(i => (
        <PendingInvite key={i.id} invite={i} company={org?.name ?? ''} onRemove={async () => { await api.deleteInvite(i.id); load() }} />
      ))}
      {me?.role === 'owner' && (
        <div className="stack" style={{ borderTop: '1px solid var(--col)', paddingTop: 12 }}>
          <div className="tiny">Brand color</div>
          <div className="row wrap">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 36, border: 0, background: 'none', padding: 0 }} />
            <input className="input" style={{ width: 110 }} value={color} onChange={e => setColor(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (/^#[0-9a-fA-F]{6}$/.test(color)) { await api.updateOrg(orgId, { accent_color: color }); onChange() }
            }}>Save</button>
          </div>
          <div className="tiny">Estimate follow-up schedule (days after sending)</div>
          <div className="row">
            <input className="input grow" value={cadence} onChange={e => setCadence(e.target.value)} />
            <button className="btn" onClick={async () => {
              const days = cadence.split(/[,\s]+/).map(Number).filter(n => n > 0 && n < 120)
              if (days.length) { await api.updateOrg(orgId, { followup_days: days }); onChange() }
            }}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

const APP_URL = typeof location !== 'undefined' ? location.origin + location.pathname : ''

function PendingInvite({ invite, company, onRemove }: { invite: Invite; company: string; onRemove: () => void }) {
  const [done, setDone] = useState('')
  const first = (invite.display_name || '').split(' ')[0]
  const text = `Hey${first ? ' ' + first : ''}, you've been added to ${company}'s CRM. ` +
    `Check your email (${invite.email}) for the invite link, or open ${APP_URL} , tap "New here? Create an account", and sign up with that email. ` +
    `Then add it to your home screen so it works like an app.`

  async function share() {
    try {
      if (navigator.share) { await navigator.share({ text }); setDone('Shared'); return }
    } catch { /* cancelled or blocked, fall back to copy */ }
    try { await navigator.clipboard.writeText(text); setDone('Copied — paste it in a text') }
    catch { setDone('Copy failed — select the message below') }
  }

  return (
    <div className="fu-row wrap" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <div>{invite.display_name} <span className="pill" style={{ marginLeft: 4 }}>{invite.role}</span></div>
        <div className="small muted">{invite.email} · invited, hasn't joined yet</div>
        {done && <div className="small" style={{ marginTop: 4 }}>{done}</div>}
        {done.startsWith('Copy failed') && <textarea className="input small" readOnly value={text} style={{ marginTop: 6 }} />}
      </div>
      <button type="button" className="btn sm primary" onClick={share}>Share invite</button>
      <button type="button" className="btn ghost sm" onClick={onRemove} title="Remove invite">Remove</button>
    </div>
  )
}
