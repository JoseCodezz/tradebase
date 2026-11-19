import { useState } from 'react'

const REASONS = ['Price — went with a cheaper bid', 'Timing — not ready yet', 'Went with another company', 'Insurance denied', 'Never responded', 'Other']

/** Asks why a lead was lost (in-app, no browser prompt). */
export default function LostReason({ name, onCancel, onConfirm }: {
  name: string; onCancel: () => void; onConfirm: (reason: string) => void
}) {
  const [pick, setPick] = useState('')
  const [other, setOther] = useState('')
  const reason = pick === 'Other' ? other.trim() : pick
  return (
    <div className="modal-wrap" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Why was {name} lost?</h2>
        <p className="small muted" style={{ margin: 0 }}>Tracking this shows where deals are leaking.</p>
        <div className="stack" style={{ gap: 6 }}>
          {REASONS.map(r => (
            <button key={r} className={'btn' + (pick === r ? ' soft' : '')} style={{ justifyContent: 'flex-start' }} onClick={() => setPick(r)}>{r}</button>
          ))}
        </div>
        {pick === 'Other' && <input className="input" autoFocus placeholder="What happened?" value={other} onChange={e => setOther(e.target.value)} />}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={!reason} onClick={() => onConfirm(reason)}>Mark as lost</button>
        </div>
      </div>
    </div>
  )
}
