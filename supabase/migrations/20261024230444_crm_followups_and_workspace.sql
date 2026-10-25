-- Alertas por oportunidade, sem presumir envio/recebimento de mensagens.
begin;
alter table public.crm_boards
 add column alerts_enabled boolean not null default true,
 add column first_response_hours integer not null default 24 check(first_response_hours between 1 and 720),
 add column idle_days integer not null default 3 check(idle_days between 1 and 90),
 add column escalation_days integer not null default 7 check(escalation_days between 1 and 180),
 add check(escalation_days>=idle_days);
alter table public.crm_stages
 add column alerts_enabled boolean,
 add column first_response_hours integer check(first_response_hours between 1 and 720),
 add column idle_days integer check(idle_days between 1 and 90),
 add column escalation_days integer check(escalation_days between 1 and 180);
create index crm_history_card_activity_idx on public.crm_contact_history(company_id,opportunity_id,occurred_at desc) where opportunity_id is not null;
create index crm_opportunities_open_idx on public.crm_opportunities(company_id,created_at,id) where not is_closed;
alter table public.crm_notifications drop constraint crm_notifications_kind_check;
alter table public.crm_notifications add check(kind in ('subscription_due','task_assigned','task_due','contact_assigned','new_contact','card_first_response','card_idle','card_escalation'));
alter table public.crm_notifications add column contact_id uuid,
 add foreign key(company_id,contact_id) references public.crm_contacts(company_id,id),
 add check((kind in ('card_first_response','card_idle','card_escalation'))=(contact_id is not null));
create index crm_notifications_contact_idx on public.crm_notifications(company_id,contact_id);

-- Notas gerais permanecem na pessoa. Uma nota/acionamento só afeta um card se houver vínculo explícito e válido.
create or replace function crm_private.stamp_contact_note() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind in ('note','whatsapp_opened') then
  new.actor_user_id:=(select auth.uid());
  new.actor_name:=coalesce((select left(p.display_name,160) from public.crm_profiles p where p.id=(select auth.uid())),'Usuário');
  new.title:=case when new.kind='note' then 'Anotação de atendimento' else 'WhatsApp acionado' end;
  new.body:=case when new.kind='note' then btrim(new.body) else 'Atalho acionado no CRM. O envio de mensagem e a resposta do cliente não são confirmados.' end;
  if length(new.body) not between 1 and 2000 then raise exception 'CRM_INVALID_NOTE' using errcode='22023';end if;
  new.occurred_at:=statement_timestamp();
  if new.opportunity_id is not null and not exists(select 1 from public.crm_opportunities o where o.company_id=new.company_id and o.id=new.opportunity_id and o.contact_id=new.contact_id) then raise exception 'CRM_INVALID_CARD' using errcode='22023';end if;
 end if;
 return new;
end;$$;

create view public.crm_card_activity with(security_invoker=true) as
with activity as (
 select o.company_id,o.id as opportunity_id,o.contact_id,o.board_id,o.stage_id,o.title,o.value_cents,o.created_at,o.follow_up_at,o.is_closed,
 c.name as contact_name,c.phone,c.owner_membership_id,coalesce(p.display_name,'Sem responsável') as owner_name,b.name as board_name,s.name as stage_name,
 coalesce(s.alerts_enabled,b.alerts_enabled) as alerts_enabled,coalesce(s.first_response_hours,b.first_response_hours) as first_response_hours,
 coalesce(s.idle_days,b.idle_days) as idle_days_threshold,coalesce(s.escalation_days,b.escalation_days) as escalation_days_threshold,
 min(h.occurred_at) as first_activity_at,max(h.occurred_at) as last_activity_at
 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
 join public.crm_boards b on b.company_id=o.company_id and b.id=o.board_id
 join public.crm_stages s on s.company_id=o.company_id and s.board_id=o.board_id and s.id=o.stage_id
 left join public.crm_memberships m on m.company_id=c.company_id and m.id=c.owner_membership_id
 left join public.crm_profiles p on p.id=m.user_id
 left join public.crm_contact_history h on h.company_id=o.company_id and h.opportunity_id=o.id and h.kind in ('note','whatsapp_opened','card_moved')
 group by o.company_id,o.id,c.id,c.name,c.phone,c.owner_membership_id,p.display_name,b.id,b.name,s.id,s.name
), effective as (
 select *,greatest(coalesce(last_activity_at,created_at),follow_up_at) as effective_since from activity
)
select *,greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/3600))::integer as hours_without_activity,
 greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/86400))::integer as days_without_activity,
 extract(epoch from effective_since)::text as activity_key
from effective;
revoke all on public.crm_card_activity from public,anon,authenticated,service_role;
grant select on public.crm_card_activity to authenticated;
create view public.crm_card_idle_report with(security_invoker=true) as select * from public.crm_card_activity
 where crm_private.company_role(company_id)='manager' and not is_closed;
revoke all on public.crm_card_idle_report from public,anon,authenticated,service_role;
grant select on public.crm_card_idle_report to authenticated;

create function crm_private.core_configure_card_alerts(p_company uuid,p_board uuid,p_stage uuid,p_first_hours integer,p_idle_days integer,p_escalation_days integer,p_enabled boolean,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.crm_boards;effective_idle integer;effective_escalation integer;
begin
 perform crm_private.core_require_manager(p_company);
 select * into b from public.crm_boards where company_id=p_company and id=p_board for update;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if p_expected_version is null or b.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if (p_first_hours is not null and p_first_hours not between 1 and 720) or (p_idle_days is not null and p_idle_days not between 1 and 90) or (p_escalation_days is not null and p_escalation_days not between 1 and 180) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 effective_idle:=coalesce(p_idle_days,b.idle_days);effective_escalation:=coalesce(p_escalation_days,b.escalation_days);
 if effective_escalation<effective_idle then raise exception 'CRM_INVALID_ALERT_THRESHOLDS' using errcode='22023';end if;
 if p_stage is null then
  if exists(select 1 from public.crm_stages s where company_id=p_company and board_id=p_board and coalesce(s.escalation_days,effective_escalation)<coalesce(s.idle_days,effective_idle)) then raise exception 'CRM_INVALID_STAGE_THRESHOLDS' using errcode='22023';end if;
  update public.crm_boards set first_response_hours=coalesce(p_first_hours,first_response_hours),idle_days=effective_idle,escalation_days=effective_escalation,alerts_enabled=coalesce(p_enabled,alerts_enabled),row_version=row_version+1 where id=p_board returning * into b;
 else
  if not exists(select 1 from public.crm_stages where company_id=p_company and board_id=p_board and id=p_stage) then raise exception 'CRM_INVALID_STAGE' using errcode='22023';end if;
  update public.crm_stages set first_response_hours=p_first_hours,idle_days=p_idle_days,escalation_days=p_escalation_days,alerts_enabled=p_enabled where company_id=p_company and id=p_stage;
  update public.crm_boards set row_version=row_version+1 where id=p_board returning * into b;
 end if;
 return to_jsonb(b);
end;$$;
revoke all on function crm_private.core_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.core_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint) to authenticated;
create function public.crm_configure_card_alerts(p_company uuid,p_board uuid,p_stage uuid,p_first_hours integer,p_idle_days integer,p_escalation_days integer,p_enabled boolean,p_expected_version bigint) returns jsonb
language sql security invoker set search_path='' as $$select crm_private.core_configure_card_alerts(p_company,p_board,p_stage,p_first_hours,p_idle_days,p_escalation_days,p_enabled,p_expected_version);$$;
revoke all on function public.crm_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint) to authenticated;

create function crm_private.core_resolve_card_alerts() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='crm_contact_history' then
  if new.opportunity_id is not null and new.kind in ('note','whatsapp_opened','card_moved') then
   update public.crm_notifications set active=false where company_id=new.company_id and entity_id=new.opportunity_id and kind in ('card_first_response','card_idle','card_escalation');
  end if;
 elsif new.is_closed or new.follow_up_at>statement_timestamp() then
  update public.crm_notifications set active=false where company_id=new.company_id and entity_id=new.id and kind in ('card_first_response','card_idle','card_escalation');
 end if;return new;
end;$$;
revoke all on function crm_private.core_resolve_card_alerts() from public,anon,authenticated,service_role;
create trigger resolve_card_alerts_after_note after insert on public.crm_contact_history for each row execute function crm_private.core_resolve_card_alerts();
create trigger resolve_card_alerts_after_edit after update on public.crm_opportunities for each row execute function crm_private.core_resolve_card_alerts();

-- Uma política comum mantém os avisos coerentes com o responsável e o perfil atuais.
create function crm_private.can_read_notification(p_company uuid,p_recipient uuid,p_kind text,p_entity uuid,p_contact uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare role text;
begin
 if p_recipient is distinct from (select auth.uid()) or not crm_private.has_current_acceptance() then return false;end if;
 role:=crm_private.company_role(p_company);
 if p_kind='subscription_due' then return role='manager';end if;
 if not crm_private.has_company_access(p_company) then return false;end if;
 if p_kind='new_contact' then return role='manager' and crm_private.can_read_contact(p_company,p_entity);end if;
 if p_kind in ('task_assigned','task_due') then return exists(select 1 from public.crm_tasks t where t.company_id=p_company and t.id=p_entity and t.status<>'done' and (crm_private.owns_membership(t.company_id,t.owner_membership_id) or (p_kind='task_due' and role='manager')) and (t.contact_id is null or crm_private.can_read_contact(t.company_id,t.contact_id)));end if;
 if p_kind='contact_assigned' then return exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_entity and crm_private.owns_membership(c.company_id,c.owner_membership_id));end if;
 if p_kind in ('card_first_response','card_idle','card_escalation') then return exists(
  select 1 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
  where o.company_id=p_company and o.id=p_entity and o.contact_id=p_contact and not o.is_closed
  and crm_private.can_read_contact(p_company,p_contact)
  and ((p_kind='card_escalation' and role='manager') or (p_kind<>'card_escalation' and crm_private.owns_membership(c.company_id,c.owner_membership_id))));end if;
 return false;
end;$$;
revoke all on function crm_private.can_read_notification(uuid,uuid,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function crm_private.can_read_notification(uuid,uuid,text,uuid,uuid) to authenticated;
drop policy notifications_read_self on public.crm_notifications;
drop policy notifications_read_state_self on public.crm_notifications;
create policy notifications_read_self on public.crm_notifications for select to authenticated using(active and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id));
create policy notifications_read_state_self on public.crm_notifications for update to authenticated using(active and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id)) with check(active and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id));

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
    union all
    select m.company_id,'card_first_response',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':first',
      'Card aguardando primeiro acompanhamento','Uma oportunidade aguarda acompanhamento há mais de '||v.first_response_hours::text||' horas. Abra o contato e confira o próximo passo.'
    from memberships m join public.crm_card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where v.alerts_enabled and not v.is_closed and v.first_activity_at is null and v.hours_without_activity>=v.first_response_hours and v.days_without_activity<v.idle_days_threshold
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,'card_idle',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':idle',
      'Card sem acompanhamento','Uma oportunidade está sem acompanhamento há '||v.idle_days_threshold::text||' dias ou mais. Confira o retorno combinado e registre o atendimento.'
    from memberships m join public.crm_card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.idle_days_threshold
      and (m.role<>'manager' or v.days_without_activity<v.escalation_days_threshold)
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,'card_escalation',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':escalation',
      'Card precisa de acompanhamento da gestão','Uma oportunidade da equipe está sem acompanhamento há '||v.escalation_days_threshold::text||' dias ou mais. Confira o responsável e as atividades registradas.'
    from memberships m join public.crm_card_activity v on v.company_id=m.company_id
    where m.role='manager' and v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.escalation_days_threshold
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())

  )
  insert into public.crm_notifications(company_id,recipient_user_id,kind,entity_id,event_key,title,body,priority,contact_id)
    select company_id,actor,kind,entity_id,event_key,title,body,
      case when kind='subscription_due' then 3 when kind in ('task_due','card_escalation') then 2 else 1 end,
      case when kind in ('card_first_response','card_idle','card_escalation') then (select o.contact_id from public.crm_opportunities o where o.company_id=candidates.company_id and o.id=candidates.entity_id) else null end from candidates
      where kind='subscription_due' or crm_private.has_company_access(company_id)
    on conflict(recipient_user_id,company_id,kind,event_key) do update set active=true,priority=excluded.priority,title=excluded.title,body=excluded.body,contact_id=excluded.contact_id;
  get diagnostics affected=row_count;
  return affected;
end;
$$;
commit;
