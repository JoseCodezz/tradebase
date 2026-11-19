-- Job photos bucket. Files live at  <org_id>/<lead_id>/<file>
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

create policy "job photos read" on storage.objects for select
  using (bucket_id = 'job-photos'
         and public.can_see_lead(((storage.foldername(name))[2])::uuid));

create policy "job photos upload" on storage.objects for insert
  with check (bucket_id = 'job-photos'
              and public.can_see_lead(((storage.foldername(name))[2])::uuid));

create policy "job photos delete" on storage.objects for delete
  using (bucket_id = 'job-photos'
         and public.is_admin(((storage.foldername(name))[1])::uuid));
