-- nothing in the CRM is callable by signed-out visitors
revoke execute on function public.accept_invites() from public, anon;
revoke execute on function public.create_organization(text, text) from public, anon;
revoke execute on function public.my_role(uuid) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_assigned(uuid) from public, anon;
revoke execute on function public.can_see_lead(uuid) from public, anon;
revoke execute on function public.leads_automation() from public, anon, authenticated;
revoke execute on function public.payments_log() from public, anon, authenticated;
revoke execute on function public.leads_before_update() from public, anon, authenticated;
