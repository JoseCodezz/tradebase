import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
import { useStore, money, daysSince, todayISO } from '../lib/store'
import LostReason from '../components/LostReason'
import { JOB_STAGES, SALES_STAGES, stageLabel, stageNext, type Lead, type Stage } from '../lib/types'

const VIEWS: { id: string; label: string; stages: Stage[] }[] = [
  { id: 'sales', label: 'Sales', stages: SALES_STAGES },
  { id: 'jobs', label: 'Sold jobs', stages: JOB_STAGES },
  { id: 'lost', label: 'Lost', stages: ['lost'] },
]

export default function Pipeline() {
  const { leads, followups, members, memberName, refresh, me } = useStore()
  const { openAdd } = useOutletContext<{ openAdd: () => void }>()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('sales')
  const [q, setQ] = useState('')
  const [rep, setRep] = useState(me?.role === 'rep' ? me.user_id : 'all')
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)

  const stages = VIEWS.find(v => v.id === view)!.stages
  const t = todayISO()
  const filtered = leads.filter(l =>
    (rep === 'all' || l.assigned_rep === rep) &&
    (!q || `${l.customer_name} ${l.address ?? ''} ${l.city ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  const nextFollowup = useMemo(() => {
    const m = new Map<string, { label: string; due: string }>()
    for (const f of [...followups].sort((a, b) => a.due_on.localeCompare(b.due_on)))
      if (!f.done_at && !f.skipped && !m.has(f.lead_id)) m.set(f.lead_id, { label: f.label, due: f.due_on })
    return m
  }, [followups])

  const totalActive = leads.filter(l => SALES_STAGES.includes(l.stage))
  const open = (id: string) => { params.set('lead', id); setParams(params) }

  const [losing, setLosing] = useState<Lead | null>(null)

  async function move(lead: Lead, stage: Stage, lost_reason?: string) {
    if (lead.stage === stage) return
    if (stage === 'lost' && lost_reason === undefined) { setLosing(lead); return }
    await api.updateLead(lead.id, stage === 'lost' ? { stage, lost_reason } : { stage })
    await refresh()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Every lead, a next step.</h1>
          <p>{totalActive.length} active opportunities · {money(totalActive.reduce((s, l) => s + (l.estimated_value ?? 0), 0))} in your pipeline</p>
        </div>
        <button className="btn primary big hide-sm" onClick={openAdd}><Plus size={17} />Add lead</button>
      </div>

      <div className="journey">
        {VIEWS.map(v => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>
            {v.label} · {leads.filter(l => v.stages.includes(l.stage)).length}
          </button>
        ))}
      </div>

      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="search grow" style={{ maxWidth: 340 }}>
          <Search size={15} />
          <input className="input" placeholder="Search customer, address or phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto' }} value={rep} onChange={e => setRep(e.target.value)}>
          <option value="all">All reps</option>
          {members.filter(m => m.role !== 'crew').map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
        </select>
      </div>

      <div className="board">
        {stages.map(stage => {
          const items = filtered.filter(l => l.stage === stage)
          return (
            <div
              key={stage}
              className={'column' + (over === stage ? ' drop' : '')}
              onDragOver={e => { e.preventDefault(); setOver(stage) }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                setOver(null)
                const l = leads.find(x => x.id === dragId)
                if (l) move(l, stage)
              }}
            >
              <div className="col-head row between">
                <div><b>{stageLabel(stage)}</b><div className="small muted">{money(items.reduce((s, l) => s + (l.sold_value ?? l.estimated_value ?? 0), 0))}</div></div>
                <span className="small muted">{items.length}</span>
              </div>
              {items.map(l => {
                const nf = nextFollowup.get(l.id)
                const late = nf && nf.due < t
                return (
                  <div
                    key={l.id} className="lead-card" draggable
                    onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                    onClick={() => open(l.id)}
                  >
                    <div className="tiny">{l.job_type}</div>
                    <div className="name">{l.customer_name}</div>
                    <div className="small muted">{[l.address, l.city].filter(Boolean).join(', ') || 'No address yet'}</div>
                    <div className="value">{money(l.sold_value ?? l.estimated_value)}</div>
                    <div className="row between small muted"><span>{memberName(l.assigned_rep)}</span><span>{daysSince(l.stage_changed_at)}d in stage</span></div>
                    <div className="next" style={late ? {} : { color: nf ? 'var(--ink)' : undefined }}>
                      <ArrowRight size={13} />
                      {nf ? `${late ? 'Overdue: ' : nf.due === t ? 'Today: ' : ''}${nf.label}` : stage === 'lost' ? (l.lost_reason || 'No reason noted') : stageNext(stage)}
                    </div>
                  </div>
                )
              })}
              {stage === 'new' && <button className="add-inline" onClick={openAdd}>+ Add lead</button>}
            </div>
          )
        })}
      </div>
      <p className="small muted">Drag a card to move it, or open it to change its stage.</p>
      {losing && <LostReason name={losing.customer_name} onCancel={() => setLosing(null)}
        onConfirm={r => { const l = losing; setLosing(null); move(l, 'lost', r) }} />}
    </div>
  )
}
