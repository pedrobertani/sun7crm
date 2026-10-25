-- Plano mensal, cortesias administrativas e carência: datas civis de São Paulo.
begin;

alter table public.crm_company_billing
  alter column monthly_amount_cents set default 18990,
  add column cycle_kind text not null default 'monthly'
    check (cycle_kind in ('monthly','complimentary','awaiting_payment'));

create table public.crm_subscription_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  actor_user_id uuid not null references public.crm_profiles(id) on delete restrict,
  kind text not null check (kind in ('payment','complimentary')),
  amount_cents integer not null default 0 check (amount_cents>=0),
  free_days integer not null default 0 check (free_days in (0,7,15,30)),
  grace_days integer not null default 0 check (grace_days between 0 and 7),
  previous_due_date date not null,
  next_due_date date not null,
  note text not null default '' check (length(note)<=500),
  created_at timestamptz not null default statement_timestamp(),
  check ((kind='payment' and free_days=0) or
         (kind='complimentary' and amount_cents=0 and grace_days=0 and free_days in (7,15,30)))
);
create index crm_subscription_events_company_time_idx
  on public.crm_subscription_events(company_id,created_at desc,id desc);
create index crm_subscription_events_actor_idx on public.crm_subscription_events(actor_user_id);
alter table public.crm_subscription_events enable row level security;
revoke all on public.crm_subscription_events from public,anon,authenticated,service_role;
grant select on public.crm_subscription_events to authenticated;
create policy subscription_events_read on public.crm_subscription_events
for select to authenticated using (
  crm_private.has_current_acceptance() and
  (crm_private.is_platform_admin() or crm_private.company_role(company_id)='manager')
);

-- Nenhum relógio ou estado de pagamento fornecido pelo navegador autoriza o CRM.
create function crm_private.subscription_state(p_due date,p_kind text,p_today date)
returns text language sql immutable security invoker set search_path='' as $$
  select case when p_due is null or p_kind='awaiting_payment' then 'awaiting_payment'
    when p_kind='complimentary' and p_today<p_due then 'complimentary'
    when p_kind='complimentary' then 'blocked'
    when p_today<=p_due then 'active'
    when p_today<=p_due+7 then 'grace'
    else 'blocked' end;
$$;
revoke all on function crm_private.subscription_state(date,text,date) from public,anon,authenticated,service_role;

create function crm_private.subscription_allows_access(p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select crm_private.subscription_state(b.due_date,b.cycle_kind,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date)
    in ('active','grace','complimentary')
    from public.crm_company_billing b where b.company_id=p_company),false);
$$;
revoke all on function crm_private.subscription_allows_access(uuid) from public,anon,authenticated,service_role;

create or replace function crm_private.has_company_access(target_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select crm_private.company_role(target_company) is not null
    and crm_private.has_current_acceptance()
    and crm_private.subscription_allows_access(target_company);
$$;

-- Uma conta bloqueada ainda encontra a própria empresa e a página Plano.
-- Contatos, tarefas, cards, histórico e relatórios continuam exigindo acesso operacional.
drop policy companies_read on public.crm_companies;
create policy companies_read on public.crm_companies for select to authenticated using (
  crm_private.has_current_acceptance() and
  (crm_private.company_role(id) is not null or crm_private.is_platform_admin())
);
drop policy memberships_read on public.crm_memberships;
create policy memberships_read on public.crm_memberships for select to authenticated using (
  crm_private.has_company_access(company_id)
  or (crm_private.has_current_acceptance() and (
    crm_private.is_platform_admin() or
    (user_id=(select auth.uid()) and active and crm_private.company_role(company_id) is not null)))
);

create function crm_private.company_subscription_access(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare bill public.crm_company_billing; state text;
begin
  if not crm_private.has_current_acceptance() or crm_private.company_role(p_company) is null then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company;
  state:=crm_private.subscription_state(bill.due_date,bill.cycle_kind,
    (statement_timestamp() at time zone 'America/Sao_Paulo')::date);
  return jsonb_build_object('access_allowed',state in ('active','grace','complimentary'),
    'status',case when crm_private.company_role(p_company)='manager' then state
      when state in ('active','grace','complimentary') then 'active' else 'blocked' end);
end;
$$;

create function crm_private.subscription_summary(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare bill public.crm_company_billing; local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  state text; events jsonb;
begin
  if not crm_private.has_current_acceptance() or
    not (crm_private.is_platform_admin() or coalesce(crm_private.company_role(p_company)='manager',false)) then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  state:=crm_private.subscription_state(bill.due_date,bill.cycle_kind,local_today);
  select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into events from (
    select id,kind,amount_cents,free_days,grace_days,previous_due_date,next_due_date,note,created_at
    from public.crm_subscription_events where company_id=p_company order by created_at desc,id desc limit 20
  ) e;
  return jsonb_build_object('company_id',p_company,'plan_name','SUN7CRM Mensal',
    'monthly_amount_cents',bill.monthly_amount_cents,'due_date',bill.due_date,
    'cycle_kind',bill.cycle_kind,'status',state,'server_date',local_today,
    'access_allowed',state in ('active','grace','complimentary'),
    'grace_days_used',case when bill.cycle_kind='monthly' then least(7,greatest(0,local_today-bill.due_date)) else 0 end,
    'grace_ends_on',case when bill.cycle_kind='monthly' then bill.due_date+7 else null end,
    'events',events);
end;
$$;

-- Cada comando tem sua própria RPC, com autoria da sessão, comparação de vencimento
-- e idempotência. O registro é administrativo; não realiza transferência bancária.
create function crm_private.record_subscription_payment(p_company uuid,p_request_id uuid,
  p_expected_due date,p_amount_cents integer,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); bill public.crm_company_billing;
  previous public.crm_subscription_events; event public.crm_subscription_events;
  local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  used_days integer; next_due date;
begin
  if actor is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_request_id is null or p_company is null or p_expected_due is null
    or p_amount_cents is null or p_amount_cents<0 or p_note is null or length(p_note)>500 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,89));
  select * into previous from public.crm_subscription_events where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>actor or previous.company_id<>p_company or previous.kind<>'payment'
      or previous.previous_due_date<>p_expected_due or previous.amount_cents<>p_amount_cents or previous.note<>btrim(p_note) then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(previous);
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if bill.due_date<>p_expected_due then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  if bill.monthly_amount_cents<>p_amount_cents then raise exception 'CRM_INVALID_AMOUNT' using errcode='22023'; end if;
  used_days:=case when bill.cycle_kind='monthly' then least(7,greatest(0,local_today-bill.due_date)) else 0 end;
  next_due:=(greatest(bill.due_date,local_today)+interval '1 month')::date-used_days;
  update public.crm_company_billing set due_date=next_due,cycle_kind='monthly' where company_id=p_company;
  insert into public.crm_subscription_events(request_id,company_id,actor_user_id,kind,amount_cents,
    grace_days,previous_due_date,next_due_date,note)
    values(p_request_id,p_company,actor,'payment',p_amount_cents,used_days,bill.due_date,next_due,btrim(p_note)) returning * into event;
  update public.crm_notifications set active=false where company_id=p_company and kind='subscription_due';
  return to_jsonb(event);
end;
$$;

create function crm_private.grant_subscription_days(p_company uuid,p_request_id uuid,
  p_expected_due date,p_days integer,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); bill public.crm_company_billing;
  previous public.crm_subscription_events; event public.crm_subscription_events;
  local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date; next_due date;
begin
  if actor is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_request_id is null or p_company is null or p_expected_due is null
    or p_days is null or p_days not in (7,15,30) or p_note is null or length(p_note)>500 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,89));
  select * into previous from public.crm_subscription_events where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>actor or previous.company_id<>p_company or previous.kind<>'complimentary'
      or previous.previous_due_date<>p_expected_due or previous.free_days<>p_days or previous.note<>btrim(p_note) then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(previous);
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if bill.due_date<>p_expected_due then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  next_due:=greatest(bill.due_date,local_today)+p_days;
  update public.crm_company_billing set due_date=next_due,cycle_kind='complimentary' where company_id=p_company;
  insert into public.crm_subscription_events(request_id,company_id,actor_user_id,kind,free_days,
    previous_due_date,next_due_date,note)
    values(p_request_id,p_company,actor,'complimentary',p_days,bill.due_date,next_due,btrim(p_note)) returning * into event;
  update public.crm_notifications set active=false where company_id=p_company and kind='subscription_due';
  return to_jsonb(event);
end;
$$;

create function public.crm_company_access_status(p_company uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select crm_private.company_subscription_access(p_company);$$;
create function public.crm_subscription_summary(p_company uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select crm_private.subscription_summary(p_company);$$;
create function public.crm_admin_record_subscription_payment(p_company uuid,p_request_id uuid,
  p_expected_due date,p_amount_cents integer,p_note text default '') returns jsonb
language sql security invoker set search_path='' as $$
  select crm_private.record_subscription_payment(p_company,p_request_id,p_expected_due,p_amount_cents,p_note);$$;
create function public.crm_admin_grant_subscription_days(p_company uuid,p_request_id uuid,
  p_expected_due date,p_days integer,p_note text default '') returns jsonb
language sql security invoker set search_path='' as $$
  select crm_private.grant_subscription_days(p_company,p_request_id,p_expected_due,p_days,p_note);$$;

revoke all on function crm_private.company_subscription_access(uuid),crm_private.subscription_summary(uuid),
  crm_private.record_subscription_payment(uuid,uuid,date,integer,text),crm_private.grant_subscription_days(uuid,uuid,date,integer,text),
  public.crm_company_access_status(uuid),public.crm_subscription_summary(uuid),
  public.crm_admin_record_subscription_payment(uuid,uuid,date,integer,text),public.crm_admin_grant_subscription_days(uuid,uuid,date,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function crm_private.company_subscription_access(uuid),crm_private.subscription_summary(uuid),
  crm_private.record_subscription_payment(uuid,uuid,date,integer,text),crm_private.grant_subscription_days(uuid,uuid,date,integer,text),
  public.crm_company_access_status(uuid),public.crm_subscription_summary(uuid),
  public.crm_admin_record_subscription_payment(uuid,uuid,date,integer,text),public.crm_admin_grant_subscription_days(uuid,uuid,date,integer,text)
  to authenticated;


-- Novas empresas aguardam quitação ou cortesia; habilitação administrativa continua separada.
create or replace function public.crm_edge_create_company(
  p_actor uuid, p_request_id uuid, p_fingerprint text, p_values jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  previous crm_private.company_provisioning;
  company uuid := gen_random_uuid();
  board uuid;
  board_kind text;
  stage_names text[];
  stage_name text;
  stage_position integer;
  selected_template text := p_values->>'template';
begin
  perform crm_private.edge_require_admin(p_actor);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from crm_private.company_provisioning where request_id = p_request_id;
  if found then
    if previous.actor_user_id <> p_actor or previous.fingerprint <> p_fingerprint then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return previous.company_id;
  end if;
  insert into public.crm_companies(name, segment, template, theme, enabled)
    values (p_values->>'name', p_values->>'segment', selected_template, p_values->>'theme', false)
    returning id into company;
  insert into public.crm_company_billing(company_id, monthly_amount_cents, due_date, cycle_kind)
    values (company, 18990, (statement_timestamp() at time zone 'America/Sao_Paulo')::date, 'awaiting_payment');
  foreach board_kind in array array['leads', 'clients'] loop
    insert into public.crm_boards(company_id, kind, name, position)
      values (company, board_kind, case when board_kind = 'leads' then 'Novos contatos' else 'Clientes' end,
        case when board_kind = 'leads' then 0 else 1 end) returning id into board;
    if board_kind = 'clients' then
      stage_names := array['Clientes ativos', 'Relacionamento', 'Indicação', 'Nova oportunidade'];
    elsif selected_template = 'generic' then
      stage_names := array['Lead novo', 'Nutrição', 'Visita agendada', 'No-show', 'Atendimento realizado', 'Fechado'];
    else
      stage_names := array['Lead novo', 'Nutrição', 'Agendado', 'No-show', 'Compareceu', 'Fechado'];
    end if;
    stage_position := 0;
    foreach stage_name in array stage_names loop
      insert into public.crm_stages(company_id, board_id, name, position)
        values (company, board, stage_name, stage_position);
      stage_position := stage_position + 1;
    end loop;
  end loop;
  insert into crm_private.company_provisioning(request_id, actor_user_id, fingerprint, company_id)
    values (p_request_id, p_actor, p_fingerprint, company);
  return company;
end;
$$;

-- Editar cadastro não pode simular renovação, retirar carência ou apagar lançamentos.
create or replace function public.crm_edge_update_company(p_actor uuid,p_request_id uuid,p_company uuid,p_fingerprint text,p_values jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare previous crm_private.company_updates;
begin
  perform crm_private.edge_require_admin(p_actor);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,12));
  select * into previous from crm_private.company_updates where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>p_actor or previous.company_id<>p_company or previous.fingerprint<>p_fingerprint then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return;
  end if;
  perform 1 from public.crm_companies where id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if (p_values->>'enabled')::boolean and not exists (
    select 1 from public.crm_memberships where company_id=p_company and role='manager' and active
  ) then raise exception 'CRM_MANAGER_REQUIRED' using errcode='23514'; end if;

  update public.crm_companies set name=p_values->>'name',segment=p_values->>'segment',
    template=p_values->>'template',theme=p_values->>'theme',enabled=(p_values->>'enabled')::boolean
    where id=p_company;
  perform 1 from public.crm_company_billing where company_id=p_company
    and monthly_amount_cents=(p_values->>'monthly_amount_cents')::integer
    and due_date=(p_values->>'due_date')::date for update;
  if not found then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  insert into crm_private.company_updates(request_id,actor_user_id,company_id,fingerprint)
    values(p_request_id,p_actor,p_company,p_fingerprint);
end;
$$;

create or replace function crm_private.refresh_notifications_for_self() returns integer
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := (select auth.uid());
  local_today date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  affected integer;
begin
  if actor is null or not crm_private.has_current_acceptance() then
    raise exception 'CRM_LEGAL_REQUIRED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 37));
  update public.crm_notifications set active=false where recipient_user_id=actor and active;

  with memberships as (
    select m.id,m.company_id,m.role from public.crm_memberships m
    join public.crm_companies c on c.id=m.company_id
    where m.user_id=actor and m.active and c.enabled
  ), candidates as (
    select m.company_id,'subscription_due'::text as kind,m.company_id as entity_id,
      b.due_date::text || ':' || b.cycle_kind || ':' || crm_private.subscription_state(b.due_date,b.cycle_kind,local_today)
        || case when b.cycle_kind='monthly' and local_today>b.due_date and local_today<=b.due_date+7
          then ':' || (local_today-b.due_date)::text else '' end as event_key,
      case when b.cycle_kind='awaiting_payment' then 'Plano aguardando liberação'
        when b.cycle_kind='complimentary' and local_today<b.due_date then 'Seu período gratuito termina em breve'
        when b.cycle_kind='complimentary' then 'Seu período gratuito terminou'
        when local_today>b.due_date+7 then 'Acesso suspenso: pagamento pendente'
        when local_today>b.due_date then 'Pagamento pendente: período de carência'
        when local_today=b.due_date then 'Seu plano vence hoje'
        else 'Seu plano vence em breve' end as title,
      case when b.cycle_kind='awaiting_payment' then 'O administrador precisa confirmar o pagamento ou conceder dias gratuitos para liberar o acesso.'
        when b.cycle_kind='complimentary' then 'Gratuidade até ' || to_char(b.due_date-1,'DD/MM/YYYY') || '. Combine a continuidade do plano com a administração.'
        when local_today>b.due_date+7 then 'A carência terminou em ' || to_char(b.due_date+7,'DD/MM/YYYY') || '. Solicite a confirmação do pagamento à administração.'
        when local_today>b.due_date then 'Dia ' || (local_today-b.due_date)::text || ' de 7 de carência. Acesso até ' || to_char(b.due_date+7,'DD/MM/YYYY') || '. Os dias utilizados serão descontados do próximo período.'
        else 'Vencimento: ' || to_char(b.due_date,'DD/MM/YYYY') || '. Combine o pagamento com a administração.' end as body
    from memberships m join public.crm_company_billing b on b.company_id=m.company_id
    where m.role='manager' and b.due_date<=local_today+7

    union all
    select m.company_id,'task_assigned',t.id,t.id::text || ':' || m.id::text,
      'Tarefa atribuída a você','Há uma tarefa pendente sob sua responsabilidade. Confira os detalhes e o prazo.'
    from memberships m join public.crm_tasks t on t.company_id=m.company_id and t.owner_membership_id=m.id
    where t.status<>'done' and t.due_date>local_today

    union all
    select m.company_id,'task_due',t.id,t.id::text || ':' || t.due_date::text || ':' || case when t.due_date<local_today then 'overdue' else 'today' end,
      case when t.due_date<local_today then 'Tarefa com prazo vencido' else 'Tarefa com prazo para hoje' end,
      case when m.role='manager' then 'Há uma tarefa da equipe que precisa de acompanhamento.' else 'Confira a tarefa sob sua responsabilidade e atualize o andamento.' end
    from memberships m join public.crm_tasks t on t.company_id=m.company_id
    where t.status<>'done' and t.due_date<=local_today and (m.role='manager' or t.owner_membership_id=m.id)

    union all
    select m.company_id,'new_contact',c.id,c.id::text,
      'Novo contato na empresa','Um novo contato entrou na carteira da empresa. Confira o responsável pelo atendimento.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id
    where m.role='manager' and c.created_at>=statement_timestamp()-interval '7 days'

    union all
    select m.company_id,'contact_assigned',c.id,c.id::text || ':' || m.id::text,
      'Contato atribuído a você','Há um contato atribuído ao seu usuário. Confira o atendimento e o próximo passo.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id and c.owner_membership_id=m.id
    where m.role in ('seller','reception') and c.updated_at>=statement_timestamp()-interval '7 days'
  )
  insert into public.crm_notifications(company_id,recipient_user_id,kind,entity_id,event_key,title,body,priority)
    select company_id,actor,kind,entity_id,event_key,title,body,
      case when kind='subscription_due' then 3 when kind='task_due' then 2 else 1 end from candidates
      where kind='subscription_due' or crm_private.has_company_access(company_id)
    on conflict(recipient_user_id,company_id,kind,event_key) do update set active=true,priority=excluded.priority;
  get diagnostics affected=row_count;
  return affected;
end;
$$;

drop policy notifications_read_self on public.crm_notifications;
create policy notifications_read_self on public.crm_notifications
for select to authenticated using (
  recipient_user_id=(select auth.uid()) and active
  and (crm_private.has_company_access(company_id) or
    (kind='subscription_due' and crm_private.has_current_acceptance() and crm_private.company_role(company_id)='manager'))
  and (kind<>'subscription_due' or crm_private.company_role(company_id)='manager')
  and (kind<>'new_contact' or crm_private.company_role(company_id)='manager')
  and (kind not in ('task_assigned','task_due') or exists (
    select 1 from public.crm_tasks t where t.company_id=crm_notifications.company_id and t.id=crm_notifications.entity_id
      and (crm_notifications.kind='task_due' or crm_private.owns_membership(t.company_id,t.owner_membership_id))
  ))
  and (kind<>'contact_assigned' or exists (
    select 1 from public.crm_contacts c where c.company_id=crm_notifications.company_id and c.id=crm_notifications.entity_id
      and crm_private.owns_membership(c.company_id,c.owner_membership_id)
  ))
);

drop policy notifications_read_state_self on public.crm_notifications;
create policy notifications_read_state_self on public.crm_notifications
for update to authenticated using (
  recipient_user_id=(select auth.uid()) and active
  and (crm_private.has_company_access(company_id) or
    (kind='subscription_due' and crm_private.has_current_acceptance() and crm_private.company_role(company_id)='manager'))
  and (kind<>'subscription_due' or crm_private.company_role(company_id)='manager')
  and (kind<>'new_contact' or crm_private.company_role(company_id)='manager')
  and (kind not in ('task_assigned','task_due') or exists (
    select 1 from public.crm_tasks t where t.company_id=crm_notifications.company_id and t.id=crm_notifications.entity_id
      and (crm_notifications.kind='task_due' or crm_private.owns_membership(t.company_id,t.owner_membership_id))
  ))
  and (kind<>'contact_assigned' or exists (
    select 1 from public.crm_contacts c where c.company_id=crm_notifications.company_id and c.id=crm_notifications.entity_id
      and crm_private.owns_membership(c.company_id,c.owner_membership_id)
  ))
) with check (
  recipient_user_id=(select auth.uid()) and active
  and (crm_private.has_company_access(company_id) or
    (kind='subscription_due' and crm_private.has_current_acceptance() and crm_private.company_role(company_id)='manager'))
  and (kind<>'subscription_due' or crm_private.company_role(company_id)='manager')
);

create or replace function crm_private.edge_authorize_user_creation(p_actor uuid, p_company uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform crm_private.edge_require_actor(p_actor);
  if not exists (select 1 from public.crm_companies where id = p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if crm_private.is_platform_admin() then
    if p_role is distinct from 'manager' then
      raise exception 'CRM_FORBIDDEN' using errcode = '42501';
    end if;
  elsif p_role is null or p_role not in ('seller', 'reception')
    or crm_private.company_role(p_company) is distinct from 'manager'
    or not crm_private.subscription_allows_access(p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;
create or replace function public.crm_edge_begin_password_reset(
  p_actor uuid, p_request_id uuid, p_company uuid, p_target uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare target_role text;
begin
  perform crm_private.edge_require_actor(p_actor);
  if p_request_id is null or p_target is null or p_actor = p_target
    or exists (select 1 from crm_private.platform_admins where user_id = p_target)
    -- Senhas do Auth são globais. Não permitir reset se o usuário tiver vínculo em outra empresa.
    or exists (select 1 from public.crm_memberships where user_id = p_target and company_id <> p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  select role into target_role from public.crm_memberships
    where company_id = p_company and user_id = p_target and active;
  if crm_private.is_platform_admin() then
    if target_role is distinct from 'manager' then
      raise exception 'CRM_FORBIDDEN' using errcode = '42501';
    end if;
  elsif crm_private.company_role(p_company) is distinct from 'manager'
    or not crm_private.subscription_allows_access(p_company)
    or target_role is null or target_role not in ('seller', 'reception') then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target::text, 2));
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 3));
  if (select count(*) from crm_private.password_reset_requests where actor_user_id = p_actor
      and created_at > statement_timestamp() - interval '15 minutes') >= 30
    or (select count(*) from crm_private.password_reset_requests where target_user_id = p_target
      and created_at > statement_timestamp() - interval '15 minutes') >= 5 then
    raise exception 'CRM_RATE_LIMITED' using errcode = 'P0003';
  end if;
  insert into crm_private.password_reset_requests(request_id, actor_user_id, company_id, target_user_id)
    values (p_request_id, p_actor, p_company, p_target);
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (p_company, p_actor, 'crm_password_reset_requested', p_target, 'UPDATE');
end;
$$;
commit;
