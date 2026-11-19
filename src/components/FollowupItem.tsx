import { useState } from 'react'
import { Check, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { useStore, todayISO } from '../lib/store'
import type { Followup, Lead } from '../lib/types'

const OUTCOMES = ['Talked to them', 'Left voicemail', 'Sent a text', 'No answer', 'Booked appointment']

export function dueLabel(due: string) {
  const t = todayISO()
  if (due < t) {
    const d = Math.round((new Date(t).getTime() - new Date(due).getTime()) / 86400000)
    return { text: `Overdue ${d}d`, cls: 'red' }
  }
  if (due === t) return { text: 'Today', cls: 'amber' }
  return { text: new Date(due + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: '' }
}

/** One follow-up with a one-tap "done" that asks how it went. */
export default function FollowupItem({ f, lead, showLead = true, onOpen }: {
  f: Followup; lead?: Lead; showLead?: boolean; onOpen?: () => void
}) {
  const { refresh, memberName } = useStore()
  const [asking, setAsking] = useState(false)
  const done = !!f.done_at
  const due = dueLabel(f.due_on)

  async function finish(outcome: string) {
    setAsking(false)
    await api.completeFollowup(f.id, outcome)
    await refresh()
  }

  return (
    <div className={'check' + (done || f.skipped ? ' done' : '')}>
      <button
        className={'checkbox' + (done ? ' on' : '')}
        disabled={done || f.skipped}
        onClick={() => setAsking(a => !a)}
        aria-label="Mark done"
      >{done && <Check size={14} />}</button>
      <div className="grow">
        <div className="row between wrap" style={{ gap: 6 }}>
          <div className="label" style={{ fontWeight: 500 }}>
            {showLead && lead ? <a onClick={onOpen} style={{ cursor: 'pointer' }}>{lead.customer_name}</a> : f.label}
          </div>
          {!done && !f.skipped && <span className={'pill ' + due.cls}>{due.text}</span>}
          {f.skipped && <span className="pill">Not needed</span>}
        </div>
        <div className="small muted">
          {showLead && lead ? `${f.label} · ` : ''}{memberName(f.assigned_to)}
          {done && ` · ${f.outcome ?? 'Done'}`}
        </div>
        {showLead && lead?.phone && !done && (
          <a href={`tel:${lead.phone}`} className="small accent row" style={{ gap: 4, marginTop: 4 }}><Phone size={12} />{lead.phone}</a>
        )}
        {asking && (
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            {OUTCOMES.map(o => <button key={o} className="btn sm" onClick={() => finish(o)}>{o}</button>)}
          </div>
        )}
      </div>
    </div>
  )
}
