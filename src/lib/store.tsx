import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type AuthUser } from './api'
import type { Assignment, Followup, Lead, Member, Organization, Payment, Role } from './types'

interface Store {
  loading: boolean
  ready: boolean
  user: AuthUser | null
  org: Organization | null
  me: Member | null
  orgs: (Member & { organization: Organization })[]
  members: Member[]
  leads: Lead[]
  followups: Followup[]
  payments: Payment[]
  assignments: Assignment[]
  refresh: () => Promise<void>
  reloadSession: () => Promise<void>
  switchOrg: (id: string) => void
  can: (...roles: Role[]) => boolean
  memberName: (id: string | null | undefined) => string
}

const Ctx = createContext<Store>(null as never)
export const useStore = () => useContext(Ctx)

const ORG_KEY = 'tradebase-org'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [orgs, setOrgs] = useState<Store['orgs']>([])
  const [orgId, setOrgId] = useState<string | null>(() => {
    try { return localStorage.getItem(ORG_KEY) } catch { return null }
  })
  const [members, setMembers] = useState<Member[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [ready, setReady] = useState(false)

  const current = orgs.find(o => o.org_id === orgId) ?? orgs[0] ?? null
  const org = current?.organization ?? null
  const me = current ? { ...current } as Member : null

  const loadedFor = useRef<string | null | undefined>(undefined)

  // Resolve who is signed in AND which companies they belong to before showing
  // anything, so the "Set up your company" screen never flashes.
  const reloadSession = useCallback(async (force = false) => {
    const u = await api.currentUser()
    if (!force && loadedFor.current === (u?.id ?? null)) return   // duplicate auth event
    loadedFor.current = u?.id ?? null
    if (!u) { setUser(null); setOrgs([]); setReady(false); setLoading(false); return }
    setLoading(true)
    let mine = await api.myMemberships()
    if (!mine.length) {                       // only new invitees need this extra step
      const joined = await api.acceptInvites().catch(() => 0)
      if (joined) mine = await api.myMemberships()
    }
    setUser(u); setOrgs(mine); setLoading(false)
  }, [])

  useEffect(() => {
    reloadSession()
    return api.onAuthChange(() => { reloadSession() })
  }, [reloadSession])

  const refresh = useCallback(async () => {
    if (!org || !me) return
    const staff = me.role !== 'crew'
    const [m, l, f, p, a] = await Promise.all([
      api.members(org.id), api.leads(org.id),
      staff ? api.followups(org.id) : Promise.resolve([]),
      staff ? api.payments(org.id) : Promise.resolve([]),
      api.assignments(org.id),
    ])
    setMembers(m); setLeads(l); setFollowups(f); setPayments(p); setAssignments(a)
    setReady(true)
  }, [org?.id, me?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  // each company's brand color themes the whole app (including the welcome screen)
  useEffect(() => {
    const c = org?.accent_color || '#b64d26'
    const root = document.documentElement.style
    root.setProperty('--accent', c)
    root.setProperty('--accent-soft', `color-mix(in srgb, ${c} 14%, white)`)
    root.setProperty('--nav-active', `color-mix(in srgb, ${c} 55%, white)`)
  }, [org?.accent_color])

  const value: Store = {
    loading, ready, user, org, me, orgs, members, leads, followups, payments, assignments,
    refresh, reloadSession: () => reloadSession(true),
    switchOrg: id => { setOrgId(id); try { localStorage.setItem(ORG_KEY, id) } catch { /* ignore */ } },
    can: (...roles) => !!me && roles.includes(me.role),
    memberName: id => members.find(m => m.user_id === id)?.display_name ?? 'Unassigned',
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const money = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US')

export const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))

export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
