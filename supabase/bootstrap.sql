-- AFTER the migration: create/invite the first user in Supabase Auth, then replace
-- owner@example.com below. This is manual provisioning, not a publicly callable function.
do $$
declare owner_id uuid; org_id uuid;
begin
  select id into owner_id from auth.users where email='owner@example.com';
  if owner_id is null then raise exception 'Create the owner Auth user and replace owner@example.com first'; end if;
  if exists(select 1 from public.memberships where user_id=owner_id) then raise exception 'User already has a workspace'; end if;
  select id into org_id from public.organizations where name='Hutashana Kitchens' order by created_at limit 1;
  if org_id is null then
    insert into public.organizations(name) values('Hutashana Kitchens') returning id into org_id;
  end if;
  insert into public.memberships values(org_id,owner_id,'owner');
  insert into public.workspaces(organization_id,settings) values(org_id,'{}') on conflict(organization_id) do nothing;
end $$;
