-- Website media buckets: only website admins (user_roles.role = 'admin') may change files.
drop policy if exists "Authenticated can upload images" on storage.objects;
drop policy if exists "Authenticated can update images" on storage.objects;
drop policy if exists "Authenticated can delete images" on storage.objects;
create policy "Admins can upload images" on storage.objects for insert to authenticated
  with check (bucket_id = any (array['hero-videos','gallery-images','case-study-images','project-images'])
              and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
create policy "Admins can update images" on storage.objects for update to authenticated
  using (bucket_id = any (array['hero-videos','gallery-images','case-study-images','project-images'])
         and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'))
  with check (bucket_id = any (array['hero-videos','gallery-images','case-study-images','project-images'])
              and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
create policy "Admins can delete images" on storage.objects for delete to authenticated
  using (bucket_id = any (array['hero-videos','gallery-images','case-study-images','project-images'])
         and exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
