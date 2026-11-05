-- WhatsApp quotation automation tables
-- Extends the existing CRM schema for WhatsApp message tracking, opt-in consent, and follow-up scheduling.

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id text not null,
  phone_number text not null,
  opt_in_status text not null check (opt_in_status in ('opted_in','opted_out','pending','unknown')) default 'unknown',
  opt_in_source text,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  last_inbound_message_at timestamptz,
  service_window_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  quotation_id text not null,
  customer_id text not null,
  phone_number text not null,
  provider_message_id text,
  direction text not null check (direction in ('outbound','inbound')) default 'outbound',
  message_type text not null check (message_type in ('document','template','text','media')) default 'document',
  template_name text,
  status text not null check (status in ('pending','sent','delivered','read','failed','unknown')) default 'pending',
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  media_object_key text,
  pdf_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_messages_quote on public.whatsapp_messages(organization_id, quotation_id);
create index whatsapp_messages_customer on public.whatsapp_messages(organization_id, customer_id);
create index whatsapp_messages_provider on public.whatsapp_messages(provider_message_id) where provider_message_id is not null;

create table if not exists public.quotation_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  quotation_id text not null,
  customer_id text not null,
  scheduled_at timestamptz not null,
  status text not null check (status in ('scheduled','sent','skipped','cancelled','failed')) default 'scheduled',
  attempts integer not null default 0,
  completed_at timestamptz,
  last_error text,
  skip_reason text,
  bull_job_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotation_followups_quote on public.quotation_followups(organization_id, quotation_id);
create index quotation_followups_due on public.quotation_followups(status, scheduled_at) where status = 'scheduled';

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  provider_event_id text not null,
  event_type text not null,
  payload_json jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_event_id, event_type)
);
create index webhook_events_provider on public.webhook_events(provider_event_id);
create index webhook_events_processed on public.webhook_events(processed_at) where processed_at is null;

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events to service_role;

alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.quotation_followups enable row level security;

-- No client policies for WhatsApp tables: access only through server-validated APIs.
revoke all on public.whatsapp_contacts, public.whatsapp_messages, public.quotation_followups from anon, authenticated;
grant all on public.whatsapp_contacts, public.whatsapp_messages, public.quotation_followups to service_role;
