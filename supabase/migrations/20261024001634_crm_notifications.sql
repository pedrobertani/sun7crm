-- Notificações internas por destinatário. Nenhum documento ou aceite é criado.
begin;

create table public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete cascade,
  recipient_user_id uuid not null references public.crm_profiles(id) on delete cascade,
  kind text not null check (kind in ('subscription_due','task_assigned','task_due','contact_assigned','new_contact')),
  entity_id uuid not null,
  event_key text not null check (length(event_key) between 1 and 200),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 500),
  priority smallint not null default 1 check (priority between 1 and 3),
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz,
  unique (recipient_user_id,company_id,kind,event_key)
);
alter table public.crm_notifications enable row level security;
revoke all on public.crm_notifications from public,anon,authenticated,service_role;
grant select on public.crm_notifications to authenticated;
grant update (read_at) on public.crm_notifications to authenticated;
create index crm_notifications_recipient_active_idx
  on public.crm_notifications(recipient_user_id,company_id,created_at desc) where active;
create index crm_notifications_unread_idx
  on public.crm_notifications(recipient_user_id,company_id) where active and read_at is null;
create index crm_notifications_company_idx on public.crm_notifications(company_id);

create policy notifications_read_self on public.crm_notifications
for select to authenticated using (
  recipient_user_id=(select auth.uid()) and active
  and crm_private.has_company_access(company_id)
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
create policy notifications_read_state_self on public.crm_notifications
for update to authenticated using (
  recipient_user_id=(select auth.uid()) and active
  and crm_private.has_company_access(company_id)
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
  and crm_private.has_company_access(company_id)
  and (kind<>'subscription_due' or crm_private.company_role(company_id)='manager')
);

-- Acesso elevado somente para projetar avisos da própria identidade autenticada.
-- Não recebe destinatário, cargo, mensagem ou empresa pelo cliente.
create function crm_private.refresh_notifications_for_self() returns integer
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
      b.due_date::text || ':' || case when b.due_date<local_today then 'overdue' when b.due_date=local_today then 'today' else 'upcoming' end as event_key,
      case when b.due_date<local_today then 'Vencimento do SUN7CRM pendente'
        when b.due_date=local_today then 'Seu acesso ao SUN7CRM vence hoje'
        else 'Seu acesso ao SUN7CRM vence em breve' end as title,
      'Vencimento: ' || to_char(b.due_date,'DD/MM/YYYY') || '. Confira a renovação com o responsável pela plataforma.' as body
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
    on conflict(recipient_user_id,company_id,kind,event_key) do update set active=true,priority=excluded.priority;
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function crm_private.refresh_notifications_for_self() from public,anon,authenticated,service_role;
grant execute on function crm_private.refresh_notifications_for_self() to authenticated;

create function public.crm_refresh_notifications() returns integer
language sql security invoker set search_path='' as $$
  select crm_private.refresh_notifications_for_self();
$$;
revoke all on function public.crm_refresh_notifications() from public,anon,authenticated,service_role;
grant execute on function public.crm_refresh_notifications() to authenticated;

create function public.crm_mark_notifications_read(p_ids uuid[]) returns integer
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  if p_ids is null or cardinality(p_ids)>100 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  update public.crm_notifications set read_at=statement_timestamp()
    where id=any(p_ids) and recipient_user_id=(select auth.uid()) and read_at is null;
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function public.crm_mark_notifications_read(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.crm_mark_notifications_read(uuid[]) to authenticated;
commit;
