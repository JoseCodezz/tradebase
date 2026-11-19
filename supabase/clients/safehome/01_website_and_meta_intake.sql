-- Safe Home Roofing workspace + website/Meta form intake.
-- Every new row in contact_submissions, quote_leads or meta_ad_leads becomes a CRM lead
-- (with its "first call" follow-up due today). The website's own tables are not changed.

create table public.intake_settings (
  id      int primary key default 1 check (id = 1),   -- single row
  org_id  uuid not null references public.organizations(id) on delete cascade
);
alter table public.intake_settings enable row level security;  -- no policies: server-side only

do $$
declare
  v_org  uuid;
  v_user uuid;
begin
  insert into public.organizations (name, accent_color)
  values ('Safe Home Roofing', '#1d4f91') returning id into v_org;
  insert into public.intake_settings (org_id) values (v_org);

  select id into v_user from auth.users where lower(email) = 'jpguaman2024@gmail.com';
  if v_user is not null then
    insert into public.memberships (org_id, user_id, role, display_name)
    values (v_org, v_user, 'owner', 'Jose Pomavilla');
  end if;
end $$;

create or replace function public.intake_job_type(p_service text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_service ilike '%gutter%'  then 'Gutters'
    when p_service ilike '%siding%'  then 'Siding'
    when p_service ilike '%window%' or p_service ilike '%door%' then 'Windows'
    when p_service ilike '%storm%' or p_service ilike '%repair%' or p_service ilike '%leak%' then 'Roof repair'
    when p_service ilike '%flat%' or p_service ilike '%rubber%' then 'Flat / rubber roof'
    when p_service ilike '%roof%'    then 'Roof replacement'
    when p_service ilike '%estimate%' or p_service ilike '%inspection%' then 'Inspection'
    else 'Other'
  end
$$;

-- contact / hero / promo forms on safehomeroofs.com
create or replace function public.intake_contact_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from intake_settings where id = 1;
  if v_org is null then return new; end if;
  insert into leads (org_id, customer_name, phone, email, source, job_type, notes, source_ref, created_by)
  values (
    v_org, coalesce(nullif(trim(new.name), ''), 'Website lead'), new.phone, new.email, 'Website',
    intake_job_type(new.service),
    concat_ws(E'\n',
      'Requested: ' || new.service,
      'Form: ' || new.form_source,
      nullif(trim(new.message), '')),
    'contact_submissions:' || new.id, null)
  on conflict (source_ref) do nothing;
  return new;
exception when others then
  return new;   -- never block a website form submission because of the CRM
end $$;

create trigger crm_intake after insert on public.contact_submissions
  for each row execute function public.intake_contact_submission();

-- detailed quote form
create or replace function public.intake_quote_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from intake_settings where id = 1;
  if v_org is null then return new; end if;
  insert into leads (org_id, customer_name, phone, email, source, job_type, estimated_value, notes, source_ref, created_by)
  values (
    v_org, coalesce(nullif(trim(new.name), ''), 'Quote request'), new.phone, new.email, 'Website quote',
    intake_job_type(new.service_type), new.estimated_price,
    concat_ws(E'\n',
      'Requested: ' || new.service_type,
      'Urgency: ' || new.urgency,
      'Property: ' || new.property_type,
      'Roof size: ' || new.roof_size,
      'Roof age: ' || new.roof_age,
      'Material: ' || new.roof_material,
      'Issues: ' || array_to_string(new.current_issues, ', '),
      'Prefers: ' || new.preferred_contact,
      nullif(trim(new.additional_notes), '')),
    'quote_leads:' || new.id, null)
  on conflict (source_ref) do nothing;
  return new;
exception when others then
  return new;
end $$;

create trigger crm_intake after insert on public.quote_leads
  for each row execute function public.intake_quote_lead();

-- Facebook / Instagram lead ads (anything that writes into meta_ad_leads)
create or replace function public.intake_meta_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from intake_settings where id = 1;
  if v_org is null then return new; end if;
  insert into leads (org_id, customer_name, phone, email, source, job_type, notes, source_ref, created_by)
  values (
    v_org, coalesce(nullif(trim(new.name), ''), 'Meta lead'), new.phone, new.email, 'Facebook / Instagram',
    intake_job_type(new.service_type),
    concat_ws(E'\n',
      'Requested: ' || new.service_type,
      'Property: ' || new.property_type,
      'Timeline: ' || new.timeline,
      'Roof age: ' || new.roof_age,
      'Issues: ' || new.issues_description,
      'Preferred: ' || new.preferred_date || ' ' || coalesce(new.preferred_time, ''),
      'Alternate: ' || new.alternate_date || ' ' || coalesce(new.alternate_time, ''),
      nullif(trim(new.additional_notes), '')),
    'meta_ad_leads:' || new.id, null)
  on conflict (source_ref) do nothing;
  return new;
exception when others then
  return new;
end $$;

create trigger crm_intake after insert on public.meta_ad_leads
  for each row execute function public.intake_meta_lead();

-- intake functions are trigger-only
revoke execute on function public.intake_contact_submission() from public, anon, authenticated;
revoke execute on function public.intake_quote_lead() from public, anon, authenticated;
revoke execute on function public.intake_meta_lead() from public, anon, authenticated;
