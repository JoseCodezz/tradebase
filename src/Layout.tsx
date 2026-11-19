import { useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { CalendarCheck, Columns3, Home, LogOut, Plus, Users, ListChecks, HardHat } from 'lucide-react'
import { useStore, todayISO } from './lib/store'
import { api, DEMO } from './lib/api'
import LeadDrawer from './components/LeadDrawer'
import AddLead from './components/AddLead'

export const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

export default function Layout() {
  const { org, me, orgs, switchOrg, followups, leads, ready } = useStore()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const leadId = params.get('lead')
  const crew = me?.role === 'crew'
  const due = followups.filter(f => !f.done_at && !f.skipped && f.due_on <= todayISO()).length
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })

  const close = () => { params.delete('lead'); setParams(params) }



  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="brand-mark"><Home size={17} /></span>tradebase</div>
        <div className="org-chip">
          {orgs.length > 1 ? (
            <select value={org?.id} onChange={e => switchOrg(e.target.value)}>
              {orgs.map(o => <option key={o.org_id} value={o.org_id}>{o.organization.name}</option>)}
            </select>
          ) : org?.name}
          <small>{me?.role} workspace</small>
        </div>
        <nav className="nav">
          {crew ? (
            <NavLink to="/" end><HardHat size={19} />My jobs</NavLink>
          ) : (
            <>
              <NavLink to="/" end><CalendarCheck size={19} />Today{due > 0 && <span className="count">{due}</span>}</NavLink>
              <NavLink to="/pipeline"><Columns3 size={19} />Pipeline</NavLink>
              <NavLink to="/leads"><ListChecks size={19} />All leads<span className="count">{leads.length}</span></NavLink>
              <NavLink to="/team"><Users size={19} />Team & stats</NavLink>
            </>
          )}
        </nav>
        <div className="side-foot">
          {!crew && <button className="btn primary" style={{ justifyContent: 'center', color: '#fff' }} onClick={() => setAdding(true)}><Plus size={16} />Add lead</button>}
          <div className="me">
            <span className="avatar">{initials(me?.display_name ?? '?')}</span>
            <div>{me?.display_name}<small>{me?.role} · {org?.name}</small></div>
          </div>
          <button onClick={() => api.signOut()}><LogOut size={16} />Sign out</button>
        </div>
      </aside>

      <div className="main">
        {DEMO && <div className="demo-banner">Demo mode — sample data stored only in this browser. Connect Supabase to go live.</div>}
        <div className="topbar">
          <span>{org?.name}</span>
          <span className="hide-sm">{date}</span>
          <button className="btn ghost sm show-sm" onClick={() => api.signOut()}><LogOut size={14} />Sign out</button>
        </div>
        {ready ? <Outlet context={{ openAdd: () => setAdding(true) }} /> : (
          <div className="page">
            <div className="skeleton" style={{ width: 320, height: 38, marginBottom: 22 }} />
            <div className="kpis">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 110 }} />)}</div>
            <div className="skeleton" style={{ height: 380 }} />
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        {crew ? (
          <NavLink to="/" end><HardHat size={20} />My jobs</NavLink>
        ) : (
          <>
            <NavLink to="/" end><CalendarCheck size={20} />Today</NavLink>
            <NavLink to="/pipeline"><Columns3 size={20} />Pipeline</NavLink>
            <button className="plus" onClick={() => setAdding(true)}><Plus size={20} />Add</button>
            <NavLink to="/leads"><ListChecks size={20} />Leads</NavLink>
            <NavLink to="/team"><Users size={20} />Team</NavLink>
          </>
        )}
      </nav>

      {leadId && <LeadDrawer id={leadId} onClose={close} />}
      {adding && <AddLead onClose={() => setAdding(false)} />}
    </div>
  )
}
