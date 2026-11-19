export type Role = 'owner' | 'office' | 'rep' | 'crew'

export type Stage =
  | 'new' | 'contacted' | 'appointment' | 'estimate_sent'
  | 'sold' | 'scheduled' | 'in_progress' | 'completed' | 'paid' | 'lost'

export interface Organization {
  id: string
  name: string
  accent_color: string
  followup_days: number[]
}

export interface Member {
  org_id: string
  user_id: string
  role: Role
  display_name: string
  phone: string | null
  active: boolean
}

export interface Invite {
  id: string
  org_id: string
  email: string
  role: Role
  display_name: string | null
  accepted_at: string | null
}

export interface Lead {
  id: string
  org_id: string
  customer_name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  source: string | null
  job_type: string
  stage: Stage
  estimated_value: number | null
  sold_value: number | null
  assigned_rep: string | null
  appointment_at: string | null
  scope_of_work: string | null
  scope_warnings: string | null
  lost_reason: string | null
  notes: string | null
  stage_changed_at: string
  sold_at: string | null
  created_at: string
}

export interface Followup {
  id: string
  org_id: string
  lead_id: string
  label: string
  due_on: string
  assigned_to: string | null
  done_at: string | null
  done_by: string | null
  outcome: string | null
  skipped: boolean
}

export interface Activity {
  id: string
  lead_id: string
  author: string | null
  kind: string
  body: string
  created_at: string
}

export interface Photo {
  id: string
  lead_id: string
  storage_path: string
  caption: string | null
  phase: string
  uploaded_by: string | null
  created_at: string
  url?: string
}

export type PayMethod = 'cash' | 'check' | 'card' | 'financing' | 'insurance' | 'other'

export interface Payment {
  id: string
  lead_id: string
  amount: number
  method: PayMethod
  received_on: string
  note: string | null
  recorded_by: string | null
}

export interface Assignment {
  lead_id: string
  user_id: string
  org_id: string
  pay_amount: number | null
  paid_out: boolean
}

export const STAGES: { id: Stage; label: string; next: string }[] = [
  { id: 'new', label: 'New lead', next: 'First call needed' },
  { id: 'contacted', label: 'Contacted', next: 'Book inspection' },
  { id: 'appointment', label: 'Appointment set', next: 'Inspect & measure' },
  { id: 'estimate_sent', label: 'Estimate sent', next: 'Follow up' },
  { id: 'sold', label: 'Sold', next: 'Schedule the crew' },
  { id: 'scheduled', label: 'Scheduled', next: 'Confirm materials' },
  { id: 'in_progress', label: 'In progress', next: 'Upload job photos' },
  { id: 'completed', label: 'Completed', next: 'Collect final payment' },
  { id: 'paid', label: 'Paid', next: 'Ask for a review' },
  { id: 'lost', label: 'Lost', next: 'Note why' },
]

export const SALES_STAGES: Stage[] = ['new', 'contacted', 'appointment', 'estimate_sent']
export const JOB_STAGES: Stage[] = ['sold', 'scheduled', 'in_progress', 'completed', 'paid']
export const WON_STAGES: Stage[] = ['sold', 'scheduled', 'in_progress', 'completed', 'paid']

export const stageLabel = (s: Stage) => STAGES.find(x => x.id === s)?.label ?? s
export const stageNext = (s: Stage) => STAGES.find(x => x.id === s)?.next ?? ''
