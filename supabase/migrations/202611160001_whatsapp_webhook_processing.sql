-- Apply after both CRM and WhatsApp quotation migrations. No customer data is removed.
create unique index whatsapp_outbound_quote_reservation
  on public.whatsapp_messages(organization_id, quotation_id)
  where direction='outbound' and status in ('pending','unknown','sent','delivered','read');
create unique index whatsapp_message_provider_identity
  on public.whatsapp_messages(organization_id, provider_message_id)
  where provider_message_id is not null;

create or replace function public.process_whatsapp_event(
  p_organization uuid, p_provider_id text, p_event_type text, p_payload jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  event_id uuid; event_processed timestamptz; event_at timestamptz;
  customer_ids text[]; target_customer_id text; quote_id text; message_row whatsapp_messages%rowtype;
  incoming_status text; incoming_rank integer; current_rank integer;
begin
  -- Serialize callbacks within an organization, including retries and out-of-order events.
  perform 1 from organizations where id=p_organization for update;
  if not found then raise exception 'Unknown organization'; end if;
  if nullif(p_provider_id,'') is null then raise exception 'Provider ID required'; end if;
  event_at := (p_payload->>'at')::timestamptz;
  if event_at is null then raise exception 'Event timestamp required'; end if;
  insert into webhook_events(organization_id,provider_event_id,event_type,payload_json)
    values(p_organization,p_provider_id,p_event_type,p_payload)
    on conflict(provider_event_id,event_type) do nothing;
  select id,processed_at into event_id,event_processed from webhook_events
    where organization_id=p_organization and provider_event_id=p_provider_id and event_type=p_event_type for update;
  if event_id is null then raise exception 'Event belongs to another organization'; end if;
  if event_processed is not null then return; end if;

  if p_event_type='message_inbound' then
    select array_agg(id) into customer_ids from crm_records
      where organization_id=p_organization and kind='customer'
      and regexp_replace(data->>'phone','[^0-9]','','g')=p_payload->>'from';
    -- Ambiguous numbers must not attach activity to the wrong customer.
    if cardinality(customer_ids)=1 then
      target_customer_id := customer_ids[1];
      insert into whatsapp_contacts(organization_id,customer_id,phone_number,last_inbound_message_at,service_window_expires_at)
        values(p_organization,target_customer_id,p_payload->>'from',event_at,event_at+interval '24 hours')
        on conflict(organization_id,customer_id) do update set
          phone_number=excluded.phone_number,
          opt_in_status=case when regexp_replace(whatsapp_contacts.phone_number,'[^0-9]','','g')<>excluded.phone_number and whatsapp_contacts.opt_in_status='opted_in' then 'unknown' else whatsapp_contacts.opt_in_status end,
          last_inbound_message_at=case when regexp_replace(whatsapp_contacts.phone_number,'[^0-9]','','g')<>excluded.phone_number then excluded.last_inbound_message_at else greatest(whatsapp_contacts.last_inbound_message_at,excluded.last_inbound_message_at) end,
          service_window_expires_at=case when regexp_replace(whatsapp_contacts.phone_number,'[^0-9]','','g')<>excluded.phone_number then excluded.service_window_expires_at else greatest(whatsapp_contacts.service_window_expires_at,excluded.service_window_expires_at) end,
          updated_at=now();
      -- A service window is not permanent messaging consent. Preserve opt-in/opt-out.
      select id into quote_id from crm_records
        where organization_id=p_organization and kind='quote' and data->>'customerId'=target_customer_id
        order by data->>'updatedAt' desc,id limit 1;
      if quote_id is not null then
        insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number,provider_message_id,direction,message_type,status,sent_at)
          values(p_organization,quote_id,target_customer_id,p_payload->>'from',p_provider_id,'inbound',p_payload->>'messageType','delivered',event_at)
          on conflict(organization_id,provider_message_id) where provider_message_id is not null do nothing;
      end if;
    end if;
  elsif p_event_type in ('message_status_sent','message_status_delivered','message_status_read','message_status_failed') then
    select * into message_row from whatsapp_messages where organization_id=p_organization and provider_message_id=p_provider_id and direction='outbound' for update;
    -- Provider may callback before sender persists its acknowledgement. Roll back and retry.
    if not found then raise exception 'Outbound message is not recorded yet'; end if;
    incoming_status := p_payload->>'status';
    if p_event_type <> 'message_status_' || incoming_status then raise exception 'Status mismatch'; end if;
    incoming_rank := case incoming_status when 'read' then 3 when 'delivered' then 2 when 'sent' then 1 else 0 end;
    current_rank := case message_row.status when 'read' then 3 when 'delivered' then 2 when 'sent' then 1 else 0 end;
    update whatsapp_messages set
      status=case when incoming_rank>current_rank or (incoming_status='failed' and current_rank<2) then incoming_status else status end,
      sent_at=case when incoming_status='sent' then coalesce(sent_at,event_at) else sent_at end,
      delivered_at=case when incoming_status='delivered' then coalesce(delivered_at,event_at) else delivered_at end,
      read_at=case when incoming_status='read' then coalesce(read_at,event_at) else read_at end,
      error_code=coalesce(p_payload->>'errorCode',error_code),
      error_message=coalesce(p_payload->>'errorMessage',error_message),updated_at=now()
      where id=message_row.id;
  else raise exception 'Unsupported WhatsApp event';
  end if;
  update webhook_events set processed_at=now() where id=event_id;
end $$;
revoke all on function public.process_whatsapp_event(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.process_whatsapp_event(uuid,text,text,jsonb) to service_role;


