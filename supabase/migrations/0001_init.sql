-- tradebase CRM — initial schema
-- Multi-company: every row belongs to an organization; row-level security keeps
-- each company's data private. Safe Home Roofing is just the first organization.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Organizations & membership
-- ---------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  accent_color  text not null default '#b64d26',
  -- follow-up cadence (days after an estimate is sent), editable per company
  followup_days int[] not null default '{1,3,7,10,14}',
  created_at    timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'office', 'rep', 'crew');

create table public.memberships (
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.member_role not null default 'rep',
  display_name  text not null,
  phone         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  email         text not null,
  role          public.member_role not null default 'rep',
  display_name  text,
  invited_by    uuid references auth.users(id),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (org_id, email)
);

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.my_role(p_org uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select role from public.memberships
  where org_id = p_org and user_id = auth.uid() and active
$$;

create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role(p_org) is not null
$$;

-- owner / office / rep = the "sales side": they see every lead in the company
create or replace function public.is_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role(p_org) in ('owner', 'office', 'rep')
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role(p_org) in ('owner', 'office')
$$;

-- ---------------------------------------------------------------------------
-- Leads / jobs (one row follows the job from first call to paid)
-- ---------------------------------------------------------------------------
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  customer_name    text not null,
  phone            text,
  email            text,
  address          text,
  city             text,
  source           text,             -- website, referral, door knock, ad...
  job_type         text not null default 'Roof replacement',
  stage            text not null default 'new'
                   check (stage in ('new','contacted','appointment','estimate_sent',
                                    'sold','scheduled','in_progress','completed','paid','lost')),
  estimated_value  numeric(12,2),
  sold_value       numeric(12,2),
  assigned_rep     uuid references auth.users(id),
  appointment_at   timestamptz,
  scope_of_work    text,             -- what the crew does
  scope_warnings   text,             -- what the crew must NOT touch
  lost_reason      text,
  notes            text,
  source_ref       text unique,      -- e.g. 'contact_submissions:<id>' for leads from the website
  stage_changed_at timestamptz not null default now(),
  sold_at          timestamptz,
  created_by       uuid references auth.users(id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index on public.leads (org_id, stage);
create index on public.leads (assigned_rep);

-- crew members assigned to a job (they only ever see jobs they're on)
create table public.job_assignments (
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  pay_amount  numeric(12,2),         -- what this person is owed for the job
  paid_out    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (lead_id, user_id)
);

create or replace function public.is_assigned(p_lead uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_assignments
                 where lead_id = p_lead and user_id = auth.uid())
$$;

create or replace function public.can_see_lead(p_lead uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead
      and (public.is_staff(l.org_id)
           or exists (select 1 from public.job_assignments a
                      where a.lead_id = l.id and a.user_id = auth.uid()))
  )
$$;

-- ---------------------------------------------------------------------------
-- Follow-ups (the checklist), activity log, photos, payments
-- ---------------------------------------------------------------------------
create table public.followups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  label       text not null,
  due_on      date not null,
  assigned_to uuid references auth.users(id),
  done_at     timestamptz,
  done_by     uuid references auth.users(id),
  outcome     text,                 -- "left voicemail", "booked", ...
  skipped     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.followups (org_id, due_on) where done_at is null and not skipped;
create index on public.followups (lead_id);

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  author      uuid references auth.users(id) default auth.uid(),
  kind        text not null default 'note',   -- note | stage | followup | payment | photo
  body        text not null,
  created_at  timestamptz not null default now()
);
create index on public.activities (lead_id, created_at desc);

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  storage_path text not null,
  caption      text,
  phase        text not null default 'before',  -- before | during | after | damage
  uploaded_by  uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index on public.photos (lead_id);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null check (method in ('cash','check','card','financing','insurance','other')),
  received_on  date not null default current_date,
  note         text,
  recorded_by  uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index on public.payments (lead_id);

-- ---------------------------------------------------------------------------
-- Automation: follow-up cadence + activity log
-- ---------------------------------------------------------------------------
create or replace function public.leads_automation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d int;
  cadence int[];
  who uuid;
begin
  who := coalesce(new.assigned_rep, auth.uid());

  if tg_op = 'INSERT' then
    insert into followups (org_id, lead_id, label, due_on, assigned_to)
    values (new.org_id, new.id, 'First call — reach out within 5 minutes', current_date, who);
    insert into activities (org_id, lead_id, kind, body)
    values (new.org_id, new.id, 'stage', 'Lead created');
    return new;
  end if;

  -- UPDATE
  if new.stage is distinct from old.stage then
    insert into activities (org_id, lead_id, kind, body)
    values (new.org_id, new.id, 'stage', 'Moved from ' || old.stage || ' to ' || new.stage);

    if new.stage = 'estimate_sent' then
      select followup_days into cadence from organizations where id = new.org_id;
      foreach d in array cadence loop
        insert into followups (org_id, lead_id, label, due_on, assigned_to)
        values (new.org_id, new.id, 'Estimate follow-up — day ' || d, current_date + d, who);
      end loop;
    elsif new.stage = 'appointment' and new.appointment_at is not null then
      insert into followups (org_id, lead_id, label, due_on, assigned_to)
      values (new.org_id, new.id, 'Confirm appointment', (new.appointment_at::date - 1), who);
    end if;

    -- once a deal is decided, the remaining sales follow-ups are no longer needed
    if new.stage in ('sold','lost') then
      update followups set skipped = true
      where lead_id = new.id and done_at is null and not skipped;
    end if;
  end if;

  if new.assigned_rep is distinct from old.assigned_rep then
    update followups set assigned_to = new.assigned_rep
    where lead_id = new.id and done_at is null and not skipped;
  end if;
  return new;
end $$;

create or replace function public.leads_before_update()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'sold' and new.sold_at is null then
      new.sold_at := now();
      new.sold_value := coalesce(new.sold_value, new.estimated_value);
    end if;
  end if;
  return new;
end $$;

create trigger leads_before_update before update on public.leads
  for each row execute function public.leads_before_update();
create trigger leads_after_insert after insert on public.leads
  for each row execute function public.leads_automation();
create trigger leads_after_update after update on public.leads
  for each row execute function public.leads_automation();

create or replace function public.payments_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into activities (org_id, lead_id, kind, body)
  values (new.org_id, new.lead_id, 'payment',
          'Payment recorded: $' || to_char(new.amount, 'FM999,999,990.00') || ' (' || new.method || ')');
  return new;
end $$;
create trigger payments_log after insert on public.payments
  for each row execute function public.payments_log();

-- ---------------------------------------------------------------------------
-- Onboarding RPCs
-- ---------------------------------------------------------------------------
-- create a company and become its owner
create or replace function public.create_organization(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into organizations (name) values (p_name) returning id into new_id;
  insert into memberships (org_id, user_id, role, display_name)
  values (new_id, auth.uid(), 'owner', p_display_name);
  return new_id;
end $$;

-- join every company that invited this email
create or replace function public.accept_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  my_email text;
  n int := 0;
  inv record;
begin
  select lower(email) into my_email from auth.users where id = auth.uid();
  if my_email is null then return 0; end if;
  for inv in select * from invites where lower(email) = my_email and accepted_at is null loop
    insert into memberships (org_id, user_id, role, display_name)
    values (inv.org_id, auth.uid(), inv.role, coalesce(inv.display_name, split_part(my_email, '@', 1)))
    on conflict (org_id, user_id) do nothing;
    update invites set accepted_at = now() where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations   enable row level security;
alter table public.memberships     enable row level security;
alter table public.invites         enable row level security;
alter table public.leads           enable row level security;
alter table public.job_assignments enable row level security;
alter table public.followups       enable row level security;
alter table public.activities      enable row level security;
alter table public.photos          enable row level security;
alter table public.payments        enable row level security;

create policy org_read   on public.organizations for select using (public.is_member(id));
create policy org_update on public.organizations for update using (public.my_role(id) = 'owner');

create policy mem_read   on public.memberships for select using (public.is_member(org_id));
create policy mem_admin  on public.memberships for update using (public.is_admin(org_id));

create policy inv_admin  on public.invites for all
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

-- leads: sales side sees all; crew sees only assigned jobs
create policy leads_read   on public.leads for select
  using (public.is_staff(org_id) or public.is_assigned(id));
create policy leads_insert on public.leads for insert with check (public.is_staff(org_id));
create policy leads_update on public.leads for update using (public.is_staff(org_id));
create policy leads_delete on public.leads for delete using (public.is_admin(org_id));

create policy assign_read  on public.job_assignments for select
  using (public.is_staff(org_id) or user_id = auth.uid());
create policy assign_write on public.job_assignments for all
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

create policy fu_read   on public.followups for select using (public.is_staff(org_id));
create policy fu_write  on public.followups for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));

create policy act_read  on public.activities for select using (public.can_see_lead(lead_id));
create policy act_write on public.activities for insert with check (public.can_see_lead(lead_id));

-- photos: anyone who can see the job (including assigned crew) can add photos
create policy photo_read   on public.photos for select using (public.can_see_lead(lead_id));
create policy photo_insert on public.photos for insert with check (public.can_see_lead(lead_id));
create policy photo_delete on public.photos for delete
  using (public.is_admin(org_id) or uploaded_by = auth.uid());

-- money: owner/office/rep only
create policy pay_read  on public.payments for select using (public.is_staff(org_id));
create policy pay_write on public.payments for insert with check (public.is_staff(org_id));
create policy pay_del   on public.payments for delete using (public.is_admin(org_id));
