import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useStore, money } from '../lib/store'
import { STAGES, stageLabel, type Stage } from '../lib/types'

export default function Leads() {
  const { leads, memberName, members } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<'all' | Stage>('all')
  const [rep, setRep] = useState('all')
  const rows = leads.filter(l =>
    (stage === 'all' || l.stage === stage) && (rep === 'all' || l.assigned_rep === rep) &&
    (!q || `${l.customer_name} ${l.address ?? ''} ${l.city ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="page">
      <div className="page-head"><div><h1>All leads</h1><p>{rows.length} of {leads.length} leads</p></div></div>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="search grow" style={{ maxWidth: 340 }}><Search size={15} /><input className="input" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="input" style={{ width: 'auto' }} value={stage} onChange={e => setStage(e.target.value as Stage)}>
          <option value="all">All stages</option>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={rep} onChange={e => setRep(e.target.value)}>
          <option value="all">All reps</option>{members.filter(m => m.role !== 'crew').map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
        </select>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead><tr><th>Customer</th><th className="hide-sm">Address</th><th>Stage</th><th className="hide-sm">Rep</th><th className="hide-sm">Source</th><th className="num">Value</th><th className="hide-sm">Created</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">No leads match.</td></tr>}
            {rows.map(l => (
              <tr key={l.id} className="click" onClick={() => { params.set('lead', l.id); setParams(params) }}>
                <td><b style={{ fontWeight: 500 }}>{l.customer_name}</b><div className="small muted">{l.phone}</div></td>
                <td className="hide-sm muted">{[l.address, l.city].filter(Boolean).join(', ')}</td>
                <td><span className={'pill ' + (l.stage === 'lost' ? '' : l.stage === 'paid' ? 'green' : l.stage === 'new' ? 'red' : 'amber')}>{stageLabel(l.stage)}</span></td>
                <td className="hide-sm">{memberName(l.assigned_rep)}</td>
                <td className="hide-sm muted">{l.source}</td>
                <td className="num">{money(l.sold_value ?? l.estimated_value)}</td>
                <td className="hide-sm muted">{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
