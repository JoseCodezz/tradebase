import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore, money, todayISO } from '../lib/store'
import FollowupItem from '../components/FollowupItem'
import { WON_STAGES, stageLabel } from '../lib/types'

export default function Today() {
  const { me, leads, followups, payments, members, memberName } = useStore()
  const [params, setParams] = useSearchParams()
  const [rep, setRep] = useState<string>(me?.role === 'rep' ? me.user_id : 'all')
  const t = todayISO()
  const open = (id: string) => { params.set('lead', id); setParams(params) }
  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])

  const mine = (uid: string | null) => rep === 'all' || uid === rep
  const dueNow = followups
    .filter(f => !f.done_at && !f.skipped && f.due_on <= t && mine(f.assigned_to) && leadById.has(f.lead_id))
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
  const overdue = dueNow.filter(f => f.due_on < t).length
  const newToday = leads.filter(l => l.created_at.slice(0, 10) === t && mine(l.assigned_rep))
  const uncalled = newToday.filter(l => l.stage === 'new').length
  const appts = leads
    .filter(l => l.appointment_at && l.appointment_at.slice(0, 10) === t && mine(l.assigned_rep))
    .sort((a, b) => a.appointment_at!.localeCompare(b.appointment_at!))
  const month = t.slice(0, 7)
  const soldMonth = leads.filter(l => WON_STAGES.includes(l.stage) && l.sold_at?.slice(0, 7) === month && mine(l.assigned_rep))
  const cashMonth = payments.filter(p => p.received_on.slice(0, 7) === month && mine(leadById.get(p.lead_id)?.assigned_rep ?? null))

  // who is behind on follow-ups (for the office to nudge)
  const behind = members.filter(m => m.role !== 'crew').map(m => ({
    m, n: followups.filter(f => !f.done_at && !f.skipped && f.due_on < t && f.assigned_to === m.user_id).length,
  })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{greet}, {me?.display_name.split(' ')[0]}.</h1>
          <p>Here's what needs attention today.</p>
        </div>
        <select className="input" style={{ width: 'auto' }} value={rep} onChange={e => setRep(e.target.value)}>
          <option value="all">Everyone</option>
          {members.filter(m => m.role !== 'crew').map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
        </select>
      </div>

      <div className="kpis">
        <div className="card pad kpi"><div className="num">{newToday.length}</div><div>New leads today</div><div className="small muted">{uncalled} still need a first call</div></div>
        <div className="card pad kpi"><div className={'num' + (overdue ? ' red' : '')}>{dueNow.length}</div><div>Follow-ups due</div><div className="small muted">{overdue} overdue</div></div>
        <div className="card pad kpi"><div className="num">{money(soldMonth.reduce((s, l) => s + (l.sold_value ?? 0), 0))}</div><div>Sold this month</div><div className="small muted">{soldMonth.length} jobs</div></div>
        <div className="card pad kpi"><div className="num">{money(cashMonth.reduce((s, p) => s + p.amount, 0))}</div><div>Collected this month</div><div className="small muted">{cashMonth.length} payments</div></div>
      </div>

      <div className="two-col">
        <div className="card pad">
          <div className="section-title"><h2>Follow-ups due</h2><span className="small muted">{dueNow.length} to do</span></div>
          {dueNow.length === 0 ? <div className="empty">All caught up. Nice.</div> :
            dueNow.map(f => <FollowupItem key={f.id} f={f} lead={leadById.get(f.lead_id)} onOpen={() => open(f.lead_id)} />)}
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="card pad">
            <div className="section-title"><h2>Today's appointments</h2></div>
            {appts.length === 0 ? <div className="empty small">No appointments today.</div> : appts.map(l => (
              <div key={l.id} className="fu-row" onClick={() => open(l.id)} style={{ cursor: 'pointer' }}>
                <b style={{ width: 56 }}>{new Date(l.appointment_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b>
                <div className="grow"><div style={{ fontWeight: 500 }}>{l.customer_name}</div><div className="small muted">{l.address}, {l.city} · {memberName(l.assigned_rep)}</div></div>
              </div>
            ))}
          </div>

          {rep === 'all' && (
            <div className="card pad">
              <div className="section-title"><h2>Who's behind</h2></div>
              {behind.length === 0 ? <div className="empty small">Nobody has overdue follow-ups.</div> : behind.map(({ m, n }) => (
                <div key={m.user_id} className="fu-row">
                  <div className="grow">{m.display_name}</div>
                  <span className="pill red">{n} overdue</span>
                  <button className="btn sm" onClick={() => setRep(m.user_id)}>View</button>
                </div>
              ))}
            </div>
          )}

          <div className="card pad">
            <div className="section-title"><h2>New today</h2></div>
            {newToday.length === 0 ? <div className="empty small">No new leads yet today.</div> : newToday.map(l => (
              <div key={l.id} className="fu-row" onClick={() => open(l.id)} style={{ cursor: 'pointer' }}>
                <div className="grow"><div style={{ fontWeight: 500 }}>{l.customer_name}</div><div className="small muted">{l.source ?? 'Unknown source'} · {memberName(l.assigned_rep)}</div></div>
                <span className={'pill ' + (l.stage === 'new' ? 'red' : 'green')}>{stageLabel(l.stage)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
