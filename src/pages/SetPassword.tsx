import { useState, type FormEvent } from 'react'
import { Home } from 'lucide-react'
import { api } from '../lib/api'
import { useStore } from '../lib/store'

/** Shown when someone opens an invite or password-reset email. */
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const { user, orgs } = useStore()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const company = orgs[0]?.organization.name

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    if (pw !== pw2) return setErr("Passwords don't match.")
    setBusy(true)
    try { await api.setPassword(pw); onDone() }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="login-form" style={{ minHeight: '100%' }}>
      <form onSubmit={submit}>
        <div className="brand" style={{ color: 'var(--ink)' }}><span className="brand-mark"><Home size={17} color="#fff" /></span>tradebase</div>
        <h1 className="serif" style={{ fontSize: 30 }}>{company ? `Welcome to ${company}` : 'Set your password'}</h1>
        <p className="muted" style={{ margin: 0 }}>Pick a password for {user?.email}. You'll use it to sign in from now on.</p>
        <label className="field">New password<input className="input" type="password" autoComplete="new-password" required value={pw} onChange={e => setPw(e.target.value)} /></label>
        <label className="field">Confirm password<input className="input" type="password" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary big" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Saving…' : 'Save password & continue'}</button>
      </form>
    </div>
  )
}
