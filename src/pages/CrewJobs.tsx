import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, MapPin } from 'lucide-react'
import { useStore, money } from '../lib/store'
import { stageLabel } from '../lib/types'

/** What a crew member sees: only the jobs they're assigned to. */
export default function CrewJobs() {
  const { leads, assignments, me } = useStore()
  const [params, setParams] = useSearchParams()
  const mine = assignments.filter(a => a.user_id === me?.user_id)
  const jobs = leads.filter(l => mine.some(a => a.lead_id === l.id))

  return (
    <div className="page">
      <div className="page-head"><div><h1>My jobs</h1><p>Read the scope before starting. Add photos as you work.</p></div></div>
      {jobs.length === 0 && <div className="card empty">No jobs assigned to you yet.</div>}
      <div className="stack" style={{ gap: 14 }}>
        {jobs.map(l => {
          const a = mine.find(x => x.lead_id === l.id)!
          return (
            <div key={l.id} className="card pad stack" onClick={() => { params.set('lead', l.id); setParams(params) }} style={{ cursor: 'pointer' }}>
              <div className="row between"><div className="tiny">{l.job_type}</div><span className="pill amber">{stageLabel(l.stage)}</span></div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{l.customer_name}</div>
              <div className="row small muted" style={{ gap: 4 }}><MapPin size={13} />{l.address}, {l.city}</div>
              {l.scope_warnings && <div className="warn-box small"><AlertTriangle size={15} />{l.scope_warnings}</div>}
              <div className="small muted">Your pay: {money(a.pay_amount)} · {a.paid_out ? 'Paid out' : 'Not paid yet'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
