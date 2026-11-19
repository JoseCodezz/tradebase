import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Home } from 'lucide-react'
import { StoreProvider, useStore } from './lib/store'
import Layout from './Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import { PASSWORD_LINK } from './lib/api'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Pipeline from './pages/Pipeline'
import Leads from './pages/Leads'
import Team from './pages/Team'
import CrewJobs from './pages/CrewJobs'

function Gate() {
  const { loading, user, orgs, me } = useStore()
  const [needsPassword, setNeedsPassword] = useState(PASSWORD_LINK)
  if (loading) return (
    <div className="splash">
      <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 13 }}><Home size={26} color="#fff" /></span>
    </div>
  )
  if (!user) return <Login />
  if (needsPassword) return <SetPassword onDone={() => setNeedsPassword(false)} />
  if (!orgs.length) return <Onboarding />
  const crew = me?.role === 'crew'
  return (
    <Routes>
      <Route element={<Layout />}>
        {crew ? (
          <>
            <Route path="/" element={<CrewJobs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Today />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/team" element={<Team />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </HashRouter>
  )
}
