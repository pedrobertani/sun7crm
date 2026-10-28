-- IDs de sandbox usam ORDTST/PAYTST; somente o ambiente de teste os aceita.
-- Valores, isolamento, idempotência e regras de renovação permanecem nas funções existentes.
begin;
alter table crm_private.payment_attempts drop constraint payment_attempts_provider_order_id_check;
alter table crm_private.payment_attempts add constraint payment_attempts_provider_order_id_check
  check (provider_order_id is null or (provider_order_id ~ '^ORD(TST)?[A-Z0-9]{26}$'
    and (environment='test' or provider_order_id !~ '^ORDTST[A-Z0-9]{26}$')));

create or replace function crm_private.edge_record_order(p_id uuid,p_order_id text,p_status text,p_payment_id text,
  p_amount_cents integer,p_method text,p_paid_at timestamptz,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt crm_private.payment_attempts; result jsonb;
begin
  if p_status is null or p_status not in ('pending','approved','rejected','cancelled','refunded','charged_back') or
    p_order_id is null or p_order_id !~ '^ORD(TST)?[A-Z0-9]{26}$' or p_environment is null or
    p_environment not in ('test','production') then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  if p_environment='production' and p_order_id ~ '^ORDTST[A-Z0-9]{26}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  select * into attempt from crm_private.payment_attempts where id=p_id and environment=p_environment for update;
  if not found then return jsonb_build_object('ignored',true); end if;
  if attempt.provider_order_id is not null and attempt.provider_order_id<>p_order_id then
    raise exception 'CRM_REFERENCE_CONFLICT' using errcode='23505';
  end if;
  if p_method is not null and p_method<>attempt.method then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  update crm_private.payment_attempts set provider_order_id=p_order_id,updated_at=statement_timestamp(),
    status=case when status in ('refunded','charged_back') then status
      when status='approved' and p_status not in ('refunded','charged_back') then status
      when status in ('rejected','cancelled') and p_status='pending' then status else p_status end where id=p_id;
  if p_payment_id is not null then
    result:=crm_private.edge_apply_provider_payment(attempt.charge_id,false,p_payment_id,p_amount_cents,p_status,p_method,p_paid_at,null,p_environment);
  elsif p_status='approved' then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  return coalesce(result,'{}'::jsonb) || jsonb_build_object('method',attempt.method);
end;
$$;

create or replace function crm_private.edge_apply_provider_payment(p_reference uuid,p_subscription boolean,p_payment_id text,
  p_amount_cents integer,p_status text,p_method text,p_paid_at timestamptz,p_cycle date default null,p_environment text default 'production') returns jsonb
language plpgsql security definer set search_path='' as $$
declare charge public.crm_subscription_charges; original public.crm_subscription_charges;
  agreement public.crm_subscription_agreements; bill public.crm_company_billing; event public.crm_subscription_events;
  company uuid; reason text:=''; result jsonb; cycle date;
begin
  if p_environment is null or p_environment not in ('test','production') or p_reference is null or p_subscription is null or p_payment_id is null or p_payment_id !~ '^([0-9]{1,30}|PAY(TST)?[A-Z0-9]{26})$'
    or p_amount_cents is null or p_amount_cents<0 or p_status is null
    or p_status not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back')
    or p_method is null or p_method not in ('unknown','pix','credit_card','other') then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment_id,93));
  if p_environment='production' and p_payment_id ~ '^PAYTST[A-Z0-9]{26}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  if p_subscription then
    select * into agreement from public.crm_subscription_agreements where id=p_reference and environment=p_environment;
    company:=agreement.company_id;
  else
    select * into original from public.crm_subscription_charges where id=p_reference and source='mercado_pago' and environment=p_environment;
    company:=original.company_id;
  end if;
  if company is null then return jsonb_build_object('ignored',true); end if;
  select * into bill from public.crm_company_billing where company_id=company for update;
  select * into charge from public.crm_subscription_charges where provider_payment_id=p_payment_id and environment=p_environment for update;
  if charge.id is not null and charge.company_id<>company then raise exception 'CRM_REFERENCE_CONFLICT' using errcode='23505'; end if;
  if p_status in ('refunded','charged_back') then
    if charge.status='refunded' and charge.provider_status=p_status then return jsonb_build_object('duplicate',true); end if;
    if charge.id is null and not p_subscription then charge:=original; end if;
    if charge.id is null and p_subscription then
      insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,status,source,kind,agreement_id,provider_cycle,environment)
        values(company,agreement.created_by,agreement.amount_cents,bill.due_date,'refunded','mercado_pago','subscription',agreement.id,p_cycle,p_environment) returning * into charge;
    end if;
    if charge.id is not null then
      update public.crm_subscription_charges set status='refunded',provider_status=p_status,last_verified_at=statement_timestamp(),
        provider_payment_id=p_payment_id,received_amount_cents=p_amount_cents,
        needs_review=true,review_reason='Pagamento estornado ou contestado. Confira o acesso e a regularização desta empresa.',updated_at=statement_timestamp() where id=charge.id;
    end if;
    return jsonb_build_object('refunded',true);
  end if;
  if charge.status in ('paid','refunded') then return jsonb_build_object('duplicate',true); end if;
  if not p_subscription then charge:=original;
  else
    cycle:=date_trunc('month',coalesce(p_cycle,(p_paid_at at time zone 'America/Sao_Paulo')::date,
      (statement_timestamp() at time zone 'America/Sao_Paulo')::date))::date;
    if charge.id is null then
      select * into charge from public.crm_subscription_charges where agreement_id=p_reference and (provider_cycle=cycle or provider_cycle is null) and status='pending' for update;
    end if;
    if charge.id is null then
      select * into charge from public.crm_subscription_charges where company_id=company and environment=p_environment and due_date=bill.due_date and status='pending' and source='manual' for update;
    end if;
    if charge.id is null then
      insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,source,kind,agreement_id,provider_cycle,environment)
        values(company,agreement.created_by,agreement.amount_cents,bill.due_date,'mercado_pago','subscription',agreement.id,cycle,p_environment)
        returning * into charge;
    end if;
    update public.crm_subscription_charges set source='mercado_pago',kind='subscription',agreement_id=agreement.id,provider_cycle=cycle where id=charge.id;
  end if;
  if p_status<>'approved' then
    update public.crm_subscription_charges set provider_status=p_status,last_verified_at=statement_timestamp(),updated_at=statement_timestamp() where id=charge.id;
    return jsonb_build_object('pending',true);
  end if;
  if p_paid_at is null then raise exception 'CRM_PAYMENT_DATE_REQUIRED' using errcode='22023'; end if;
  if p_subscription and agreement.status='cancelled' then reason:='Recebimento de uma assinatura cancelada. Confira a aplicação deste pagamento.';
  elsif charge.status<>'pending' then reason:='Outro recebimento já encerrou esta cobrança. Confira este pagamento adicional.';
  elsif charge.amount_cents<>p_amount_cents or bill.monthly_amount_cents<>p_amount_cents then reason:='O valor recebido difere do valor contratado. Confira antes de renovar o acesso.';
  elsif charge.due_date<>bill.due_date then reason:='O plano mudou depois da criação da cobrança. Confira a aplicação deste recebimento.';
  elsif p_subscription and exists(select 1 from public.crm_subscription_charges where agreement_id=p_reference and provider_cycle=cycle and event_id is not null) then
    reason:='Já houve renovação neste ciclo da assinatura. Confira o pagamento adicional.';
  end if;
  if charge.status<>'pending' then
    insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,status,source,kind,agreement_id,provider_cycle,environment)
      values(company,charge.created_by,charge.amount_cents,charge.due_date,'paid','mercado_pago',charge.kind,charge.agreement_id,charge.provider_cycle,p_environment) returning * into charge;
  end if;
  update public.crm_subscription_charges set provider_payment_id=p_payment_id,received_amount_cents=p_amount_cents,
    provider_status=p_status,payment_method=p_method,paid_at=p_paid_at,last_verified_at=statement_timestamp(),
    needs_review=(reason<>''),review_reason=reason,updated_at=statement_timestamp() where id=charge.id;
  if p_environment='test' then
    update public.crm_subscription_charges set status='paid',needs_review=false,review_reason='Pagamento de teste. Nenhuma renovação de acesso foi realizada.' where id=charge.id;
    result:=jsonb_build_object('test',true);
  elsif reason='' then
    result:=crm_private.apply_subscription_payment(charge.created_by,company,charge.id,bill.due_date,p_amount_cents,'Pagamento confirmado pelo Mercado Pago.');
    update public.crm_subscription_charges set paid_at=p_paid_at where id=charge.id;
  else
    update public.crm_subscription_charges set status='paid' where id=charge.id;
    result:=jsonb_build_object('review',true);
  end if;
  return result;
end;
$$;

commit;
