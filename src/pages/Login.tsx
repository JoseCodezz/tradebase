import { useState, type FormEvent } from 'react'
import { Home } from 'lucide-react'
import { api, DEMO } from '../lib/api'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setMsg(''); setBusy(true)
    try {
      if (mode === 'in') { await api.signIn(email, password); return }   // stays "Signing in…" until the app opens
      await api.signUp(email, password); setMsg('Account created. If asked, confirm your email, then sign in.')
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="brand"><span className="brand-mark"><Home size={17} /></span>tradebase</div>
        <h1>Every lead, a next step.</h1>
        <p className="muted">From the first call to the final payment.</p>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <h1 className="serif" style={{ fontSize: 30 }}>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {mode === 'in' ? 'Sign in to your company workspace.' : 'Use the email your company invited, or start a new company.'}
          </p>
          {DEMO && <div className="pill amber">Demo mode — any email and password works</div>}
          <label className="field">Email<input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="field">Password<input className="input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
          {err && <div className="error">{err}</div>}
          {msg && <div className="pill green">{msg}</div>}
          <button className="btn primary big" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? (mode === 'in' ? 'Signing in…' : 'Creating…') : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="btn ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
