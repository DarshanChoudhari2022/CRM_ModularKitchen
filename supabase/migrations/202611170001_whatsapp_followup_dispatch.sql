-- Reserve one next-day follow-up per quotation and retain uncertain dispatches for review.
alter table public.quotation_followups drop constraint if exists quotation_followups_status_check;
alter table public.quotation_followups add constraint quotation_followups_status_check
  check (status in ('scheduled','sending','sent','skipped','cancelled','failed','unknown'));
alter table public.quotation_followups add column claim_token uuid;
alter table public.quotation_followups add column claimed_at timestamptz;
alter table public.quotation_followups add column provider_message_id text;
alter table public.quotation_followups add column delivery_status text
  check (delivery_status in ('sent','delivered','read','failed'));

create unique index quotation_followups_one_active_per_quote
  on public.quotation_followups(organization_id, quotation_id)
  where status in ('scheduled','sending','unknown','sent');

alter table public.whatsapp_messages add column followup_id uuid
  references public.quotation_followups(id);
create unique index whatsapp_messages_one_followup_attempt
  on public.whatsapp_messages(followup_id) where followup_id is not null;

-- Initial quotation reservation must not exclude the distinct follow-up message.
drop index public.whatsapp_outbound_quote_reservation;
create unique index whatsapp_outbound_quote_reservation
  on public.whatsapp_messages(organization_id, quotation_id)
  where direction='outbound' and followup_id is null
    and status in ('pending','unknown','sent','delivered','read');

create or replace function public.claim_quotation_followups(
  p_organization uuid, p_limit integer default 3
) returns setof public.quotation_followups
language plpgsql security definer set search_path=public as $$
begin
  if p_limit < 1 or p_limit > 10 then raise exception 'Invalid follow-up claim limit'; end if;

  -- A process may die after provider submission. Never put its lease back in queue.
  update quotation_followups set status='unknown', completed_at=now(),
    last_error='Worker lease expired. Reconcile with Meta before any retry.', updated_at=now()
  where organization_id=p_organization and status='sending'
    and claimed_at < now() - interval '10 minutes';

  return query
  with due as (
    select id from quotation_followups
    where organization_id=p_organization and status='scheduled' and scheduled_at<=now()
    order by scheduled_at,id limit p_limit for update skip locked
  )
  update quotation_followups f set status='sending', attempts=attempts+1,
    claim_token=gen_random_uuid(), claimed_at=now(), updated_at=now()
  from due where f.id=due.id returning f.*;
end $$;
revoke all on function public.claim_quotation_followups(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_quotation_followups(uuid,integer) to service_role;

-- Preserve original webhook processing while adding opt-out and follow-up delivery state.
alter function public.process_whatsapp_event(uuid,text,text,jsonb)
  rename to process_whatsapp_event_base;
revoke all on function public.process_whatsapp_event_base(uuid,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.process_whatsapp_event_base(uuid,text,text,jsonb)
  to service_role;

create function public.process_whatsapp_event(
  p_organization uuid, p_provider_id text, p_event_type text, p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  customer_ids text[];
  linked_followup uuid;
  current_delivery text;
begin
  -- Serialize before the duplicate check so replay cannot revoke later consent.
  perform 1 from organizations where id=p_organization for update;
  if exists (
    select 1 from webhook_events where organization_id=p_organization
      and provider_event_id=p_provider_id and event_type=p_event_type
      and processed_at is not null
  ) then return; end if;

  perform process_whatsapp_event_base(p_organization,p_provider_id,p_event_type,p_payload);

  if p_event_type='message_inbound' and
     upper(trim(coalesce(p_payload->>'text',''))) in ('STOP','UNSUBSCRIBE','CANCEL','END','QUIT') then
    select array_agg(id) into customer_ids from crm_records
      where organization_id=p_organization and kind='customer'
        and regexp_replace(data->>'phone','[^0-9]','','g')=p_payload->>'from';
    if cardinality(customer_ids)=1 then
      update whatsapp_contacts set opt_in_status='opted_out',
        opted_out_at=coalesce(opted_out_at,(p_payload->>'at')::timestamptz),
        opt_in_source='whatsapp_stop',updated_at=now()
      where organization_id=p_organization and customer_id=customer_ids[1];
    end if;
  elsif p_event_type in ('message_status_sent','message_status_delivered','message_status_read','message_status_failed') then
    select m.followup_id,m.status into linked_followup,current_delivery
      from whatsapp_messages m where m.organization_id=p_organization
        and m.provider_message_id=p_provider_id and m.direction='outbound';
    if linked_followup is not null and current_delivery in ('sent','delivered','read','failed') then
      update quotation_followups set delivery_status=current_delivery,updated_at=now()
        where id=linked_followup and organization_id=p_organization;
    end if;
  end if;
end $$;
revoke all on function public.process_whatsapp_event(uuid,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.process_whatsapp_event(uuid,text,text,jsonb)
  to service_role;
