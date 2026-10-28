-- Recusa definitiva de criação encerra a reserva, preservando a cobrança administrativa.
begin;

create or replace function crm_private.edge_update_agreement(p_id uuid,p_provider_id text,p_status text,p_environment text default 'production') returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_status is null or p_status not in ('pending','authorized','paused','cancelled')
    or p_environment is null or p_environment not in ('test','production') then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  if p_provider_id is null then
    if p_status<>'cancelled' then
      raise exception 'CRM_INVALID_INPUT' using errcode='22023';
    end if;
    update public.crm_subscription_agreements set status='cancelled',updated_at=statement_timestamp()
      where id=p_id and environment=p_environment and status='creating'
        and provider_id is null and checkout_url is null;
    if found then
      update public.crm_subscription_charges set source='manual',kind='one_time',agreement_id=null,
        updated_at=statement_timestamp()
        where agreement_id=p_id and status='pending' and provider_payment_id is null
          and checkout_url is null and event_id is null and coalesce(received_amount_cents,0)=0;
    end if;
    return;
  end if;
  update public.crm_subscription_agreements set status=p_status,provider_id=p_provider_id,updated_at=statement_timestamp()
    where id=p_id and environment=p_environment and (provider_id is null or provider_id=p_provider_id)
      and (status<>'cancelled' or p_status='cancelled');
  if found and p_status='cancelled' then
    update public.crm_subscription_charges set status='cancelled',cancelled_at=statement_timestamp(),
      cancelled_reason='Assinatura cancelada no Mercado Pago.',updated_at=statement_timestamp()
      where agreement_id=p_id and status='pending';
  end if;
end;
$$;

-- CREATE OR REPLACE preserva as permissões existentes: helper privado e wrapper service_role.
commit;
