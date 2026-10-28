-- Server-owned CRM data. Browser tokens have no access to business-record tables.
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now()
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','estimator','sales','accounts','manager','installer')),
  primary key (organization_id,user_id)
);
create table public.workspaces (
  organization_id uuid primary key references public.organizations(id),
  revision bigint not null default 0, settings jsonb not null default '{}'::jsonb
);
create table public.crm_records (
  organization_id uuid not null references public.organizations(id),
  id text not null, kind text not null check (kind in ('lead','customer','project','catalog','quote','invoice','receipt','task','purchase','service','clause','survey','call','bom','changeOrder')),
  data jsonb not null check (data->>'id'=id and data->>'kind'=kind),
  updated_at timestamptz not null default now(), primary key (organization_id,id)
);
create index crm_records_kind on public.crm_records(organization_id,kind);
create index crm_records_customer on public.crm_records(organization_id,(data->>'customerId'));
create unique index crm_invoice_number on public.crm_records(organization_id,(data->>'number')) where kind='invoice' and data->>'number' is not null;
create unique index crm_payment_reference on public.crm_records(organization_id,(data->>'customerId'),(data->>'reference')) where kind='receipt';
create unique index crm_source_event on public.crm_records(organization_id,(data->>'source'),(data->>'sourceEventId')) where kind='lead' and data->>'sourceEventId' is not null;
create unique index crm_catalog_sku on public.crm_records(organization_id,lower(data->>'sku'),coalesce((data->>'revision')::int,1)) where kind='catalog' and coalesce(data->>'sku','')<>'';
create table public.audit_log (
  id text primary key, organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id), created_at timestamptz not null default now(), data jsonb not null
);
create index audit_log_org on public.audit_log(organization_id,created_at desc);
create table public.outbox_jobs (
  id text primary key, organization_id uuid not null references public.organizations(id),
  status text not null check(status in ('Pending','Sending','Sent','Suppressed','Failed','Unknown')),
  due_at timestamptz not null, data jsonb not null, locked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index outbox_due on public.outbox_jobs(status,due_at) where status='Pending';
create unique index outbox_one_active_invoice on public.outbox_jobs(organization_id,(data->>'invoiceId')) where status in ('Pending','Sending','Unknown');
create table public.integration_events (
  organization_id uuid not null references public.organizations(id), provider text not null,
  external_id text not null, created_at timestamptz not null default now(), data jsonb not null,
  primary key(organization_id,provider,external_id)
);
create table public.contact_dispatches (
  organization_id uuid not null references public.organizations(id), customer_id text not null,
  last_dispatched_at timestamptz not null, primary key(organization_id,customer_id)
);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.workspaces enable row level security;
alter table public.crm_records enable row level security;
alter table public.audit_log enable row level security;
alter table public.outbox_jobs enable row level security;
alter table public.integration_events enable row level security;
alter table public.contact_dispatches enable row level security;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
-- No client policies for business tables: access is only through server-validated APIs.
revoke all on public.organizations,public.workspaces,public.crm_records,public.audit_log,public.outbox_jobs,public.integration_events,public.contact_dispatches from anon,authenticated;
revoke all on public.memberships from anon,authenticated;
grant select on public.memberships to authenticated;
grant all on public.organizations,public.memberships,public.workspaces,public.crm_records,public.audit_log,public.outbox_jobs,public.integration_events,public.contact_dispatches to service_role;

create or replace function public.commit_workspace(
  p_organization uuid,p_actor uuid,p_revision bigint,p_settings jsonb,
  p_records jsonb,p_jobs jsonb,p_audit jsonb
) returns bigint language plpgsql security definer set search_path=public as $$
declare current_revision bigint; item jsonb;
begin
  if not exists(select 1 from memberships where organization_id=p_organization and user_id=p_actor) then
    raise exception 'Membership required' using errcode='42501';
  end if;
  select revision into current_revision from workspaces where organization_id=p_organization for update;
  if current_revision is null or current_revision<>p_revision then
    raise exception 'Workspace changed. Reload before retrying.' using errcode='40001';
  end if;
  if jsonb_array_length(p_records)>10000 then raise exception 'Record limit exceeded'; end if;
  for item in select value from jsonb_array_elements(p_records) loop
    insert into crm_records(organization_id,id,kind,data) values(p_organization,item->>'id',item->>'kind',item)
    on conflict(organization_id,id) do update set data=excluded.data,updated_at=now();
  end loop;
  for item in select value from jsonb_array_elements(p_jobs) loop
    insert into outbox_jobs(id,organization_id,status,due_at,data)
    values(item->>'id',p_organization,item->>'status',(item->>'dueAt')::timestamptz,item)
    on conflict(id) do update set status=excluded.status,data=excluded.data,updated_at=now()
      where outbox_jobs.organization_id=p_organization and (outbox_jobs.status='Pending' or (outbox_jobs.status='Unknown' and excluded.status in ('Sent','Failed')));
  end loop;
  insert into audit_log(id,organization_id,actor_id,data) values(p_audit->>'id',p_organization,p_actor,p_audit);
  update workspaces set revision=revision+1,settings=p_settings where organization_id=p_organization;
  return current_revision+1;
end $$;
revoke all on function public.commit_workspace(uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_workspace(uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb) to service_role;

create or replace function public.claim_reminders(p_limit integer default 10)
returns setof public.outbox_jobs language plpgsql security definer set search_path=public as $$
begin
  -- A crashed/uncertain external dispatch is never blindly retried.
  update outbox_jobs set status='Unknown',data=jsonb_set(data,'{status}','"Unknown"'),updated_at=now()
  where status='Sending' and locked_at<now()-interval '5 minutes';
  return query with candidates as (
    select id from outbox_jobs where status='Pending' and due_at<=now()
    order by due_at for update skip locked limit least(greatest(p_limit,1),20)
  ) update outbox_jobs j set status='Sending',locked_at=now(),updated_at=now(),
    data=jsonb_set(jsonb_set(j.data,'{status}','"Sending"'),'{attempts}',to_jsonb(coalesce((j.data->>'attempts')::int,0)+1))
  from candidates c where j.id=c.id returning j.*;
end $$;
revoke all on function public.claim_reminders(integer) from public,anon,authenticated;
grant execute on function public.claim_reminders(integer) to service_role;

create or replace function public.reserve_contact(p_organization uuid,p_customer text,p_gap_hours integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  insert into contact_dispatches(organization_id,customer_id,last_dispatched_at)
  values(p_organization,p_customer,now()) on conflict(organization_id,customer_id)
  do update set last_dispatched_at=now() where contact_dispatches.last_dispatched_at<now()-make_interval(hours=>greatest(p_gap_hours,24));
  get diagnostics affected=row_count; return affected>0;
end $$;
revoke all on function public.reserve_contact(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_contact(uuid,text,integer) to service_role;

-- One SQL statement gives a consistent MVCC snapshot and one JSON row, avoiding
-- PostgREST's default 1,000-row cap. Retain ALL active/unresolved jobs for dedupe.
create or replace function public.read_workspace(p_organization uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'revision',w.revision,'settings',w.settings,
    'records',coalesce((select jsonb_agg(r.data order by r.id) from crm_records r where r.organization_id=p_organization),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(a.data order by a.created_at desc) from (select data,created_at from audit_log where organization_id=p_organization order by created_at desc limit 250) a),'[]'::jsonb),
    'jobs',coalesce((select jsonb_agg(j.data) from outbox_jobs j where j.organization_id=p_organization and (j.status in ('Pending','Sending','Unknown') or j.id in (select id from outbox_jobs where organization_id=p_organization order by updated_at desc limit 250))),'[]'::jsonb)
  ) from workspaces w where w.organization_id=p_organization;
$$;
revoke all on function public.read_workspace(uuid) from public,anon,authenticated;
grant execute on function public.read_workspace(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-private','crm-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- No browser storage policies. Signed URLs are generated by the authenticated server.
