import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

export const SOURCES = ['Website', 'Google', 'Facebook / Instagram', 'Referral', 'Door knock', 'Yard sign', 'Repeat customer', 'Other']
export const JOB_TYPES = ['Roof replacement', 'Roof repair', 'Siding', 'Gutters', 'Windows', 'Flat / rubber roof', 'Inspection', 'Other']

export default function AddLead({ onClose }: { onClose: () => void }) {
  const { org, me, members, refresh } = useStore()
  const [params, setParams] = useSearchParams()
  const [f, setF] = useState({
    customer_name: '', phone: '', email: '', address: '', city: '', source: 'Website',
    job_type: 'Roof replacement', estimated_value: '', assigned_rep: me?.role === 'rep' ? me.user_id : '', notes: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const lead = await api.createLead({
        org_id: org!.id, customer_name: f.customer_name.trim(),
        phone: f.phone || null, email: f.email || null, address: f.address || null, city: f.city || null,
        source: f.source, job_type: f.job_type,
        estimated_value: f.estimated_value ? Number(f.estimated_value.replace(/[^0-9.]/g, '')) : null,
        assigned_rep: f.assigned_rep || null, notes: f.notes || null,
      })
      await refresh()
      onClose()
      params.set('lead', lead.id); setParams(params)
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="modal-wrap" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>New lead</h2>
        <label className="field">Customer name *<input className="input" required autoFocus value={f.customer_name} onChange={set('customer_name')} /></label>
        <div className="grid2">
          <label className="field">Phone<input className="input" type="tel" value={f.phone} onChange={set('phone')} /></label>
          <label className="field">Email<input className="input" type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <div className="grid2">
          <label className="field">Street address<input className="input" value={f.address} onChange={set('address')} /></label>
          <label className="field">City, state<input className="input" value={f.city} onChange={set('city')} placeholder="Leominster, MA" /></label>
        </div>
        <div className="grid2">
          <label className="field">Job type<select className="input" value={f.job_type} onChange={set('job_type')}>{JOB_TYPES.map(j => <option key={j}>{j}</option>)}</select></label>
          <label className="field">Lead source<select className="input" value={f.source} onChange={set('source')}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></label>
        </div>
        <div className="grid2">
          <label className="field">Estimated value ($)<input className="input" inputMode="decimal" value={f.estimated_value} onChange={set('estimated_value')} placeholder="18,500" /></label>
          <label className="field">Assigned rep
            <select className="input" value={f.assigned_rep} onChange={set('assigned_rep')}>
              <option value="">Unassigned</option>
              {members.filter(m => m.role !== 'crew').map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">Notes<textarea className="input" value={f.notes} onChange={set('notes')} placeholder="What did they say? Leak in the kitchen, storm damage, wants a quote by Friday…" /></label>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Add lead</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>A "first call" follow-up is created automatically, due today.</p>
      </form>
    </div>
  )
}
