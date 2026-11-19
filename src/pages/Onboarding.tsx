import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

export default function Onboarding() {
  const { user, reloadSession } = useStore()
  const [company, setCompany] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api.createOrganization(company, name); await reloadSession() }
    catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="login-form" style={{ minHeight: '100%' }}>
      <form onSubmit={create}>
        <h1 className="serif" style={{ fontSize: 30 }}>Set up your company</h1>
        <p className="muted" style={{ margin: 0 }}>
          Signed in as {user?.email}. If your company already uses tradebase, ask the owner to invite this email, then
          {' '}<button type="button" className="btn ghost sm" onClick={() => reloadSession()}>check again</button>.
        </p>
        <label className="field">Company name<input className="input" required value={company} onChange={e => setCompany(e.target.value)} placeholder="Safe Home Roofing" /></label>
        <label className="field">Your name<input className="input" required value={name} onChange={e => setName(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary big" disabled={busy} style={{ justifyContent: 'center' }}>Create company</button>
        <button type="button" className="btn ghost" onClick={() => api.signOut()}>Sign out</button>
      </form>
    </div>
  )
}
