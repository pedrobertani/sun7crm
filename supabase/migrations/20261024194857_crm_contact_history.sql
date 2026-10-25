begin;

create table public.crm_contact_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid,
  actor_user_id uuid,
  actor_name text not null default 'Sistema' check(length(actor_name)<=160),
  kind text not null check(kind in ('contact_created','contact_updated','card_created','card_updated','card_moved','note','whatsapp_opened')),
  title text not null check(length(title) between 1 and 180),
  body text not null default '' check(length(body)<=2000),
  occurred_at timestamptz not null default statement_timestamp(),
  foreign key(company_id,contact_id) references public.crm_contacts(company_id,id) on delete restrict
);
create index crm_contact_history_timeline_idx on public.crm_contact_history(company_id,contact_id,occurred_at desc,id desc);
alter table public.crm_contact_history enable row level security;
revoke all on public.crm_contact_history from public,anon,authenticated,service_role;
grant select,insert on public.crm_contact_history to authenticated;

-- Notes are attributed and timestamped by the database, not by browser input.
create function crm_private.stamp_contact_note() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind in ('note','whatsapp_opened') then
  new.actor_user_id := (select auth.uid());
  new.actor_name := coalesce((select left(p.display_name,160) from public.crm_profiles p where p.id=(select auth.uid())),'Usuário');
  new.title := case when new.kind='note' then 'Anotação de atendimento' else 'WhatsApp acionado' end;
  new.body := case when new.kind='note' then btrim(new.body) else 'Atalho acionado no CRM. O envio de mensagem e a resposta do cliente não são confirmados.' end;
  if length(new.body) not between 1 and 2000 then raise exception 'Escreva uma anotação de até 2.000 caracteres.' using errcode='22023'; end if;
  new.occurred_at := statement_timestamp();
  new.opportunity_id := null;
 end if;
 return new;
end;
$$;
revoke all on function crm_private.stamp_contact_note() from public,anon,authenticated,service_role;
create trigger stamp_contact_note before insert on public.crm_contact_history for each row execute function crm_private.stamp_contact_note();

create policy contact_history_read on public.crm_contact_history for select to authenticated
 using(crm_private.can_read_contact(company_id,contact_id));
create policy contact_history_note_insert on public.crm_contact_history for insert to authenticated
 with check(actor_user_id=(select auth.uid()) and ((kind='note' and crm_private.can_write_contact(company_id,contact_id)) or (kind='whatsapp_opened' and crm_private.can_read_contact(company_id,contact_id))));

-- A private, non-callable trigger writes automatic events inside the same transaction.
-- Clients cannot insert those kinds or change/delete any history row.
create function crm_private.log_contact_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := (select auth.uid());
 actor_label text;
 contact uuid;
 event_kind text;
 event_title text;
 event_body text;
 fields text[] := '{}';
 old_stage text;
 new_stage text;
 card_id uuid;
begin
 select left(p.display_name,160) into actor_label from public.crm_profiles p where p.id=actor;
 actor_label := coalesce(actor_label,'Sistema');
 if tg_table_name='crm_contacts' then
  contact := new.id;
  if tg_op='INSERT' then event_kind:='contact_created';event_title:='Contato cadastrado';event_body:='Cadastro criado no CRM.';
  else
   if old.name is distinct from new.name then fields:=array_append(fields,'nome');end if;
   if old.phone is distinct from new.phone then fields:=array_append(fields,'telefone');end if;
   if old.email is distinct from new.email then fields:=array_append(fields,'e-mail');end if;
   if old.temperature is distinct from new.temperature then fields:=array_append(fields,'temperatura');end if;
   if old.owner_membership_id is distinct from new.owner_membership_id then fields:=array_append(fields,'responsável');end if;
   if old.interests is distinct from new.interests then fields:=array_append(fields,'interesses');end if;
   if old.notes is distinct from new.notes then fields:=array_append(fields,'observações');end if;
   if cardinality(fields)=0 then return new;end if;
   event_kind:='contact_updated';event_title:='Cadastro atualizado';event_body:='Campos alterados: '||array_to_string(fields,', ')||'.';
  end if;
 elsif tg_table_name='crm_opportunities' then
  contact:=new.contact_id;card_id:=new.id;
  select b.name||' / '||s.name into new_stage from public.crm_stages s join public.crm_boards b on b.id=s.board_id and b.company_id=s.company_id where s.id=new.stage_id and s.company_id=new.company_id;
  if tg_op='INSERT' then event_kind:='card_created';event_title:='Novo card';event_body:='Oportunidade criada em '||coalesce(new_stage,'etapa inicial')||'.';
  else
   if old.contact_id is distinct from new.contact_id then
    insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body)
     values(old.company_id,old.contact_id,old.id,actor,actor_label,'card_updated','Card desvinculado','Uma oportunidade foi desvinculada deste contato.');
    event_kind:='card_created';event_title:='Card vinculado';event_body:='Oportunidade vinculada em '||coalesce(new_stage,'etapa atual')||'.';
   elsif old.stage_id is distinct from new.stage_id or old.board_id is distinct from new.board_id then
    select b.name||' / '||s.name into old_stage from public.crm_stages s join public.crm_boards b on b.id=s.board_id and b.company_id=s.company_id where s.id=old.stage_id and s.company_id=old.company_id;
    event_kind:='card_moved';event_title:='Card movimentado';event_body:=coalesce(old_stage,'Etapa anterior')||' → '||coalesce(new_stage,'Nova etapa')||'.';
   elsif old.value_cents is distinct from new.value_cents or old.source is distinct from new.source then
    event_kind:='card_updated';event_title:='Card atualizado';event_body:='Valor ou origem da oportunidade atualizados.';
   else return new;
   end if;
  end if;
 else raise exception 'Tabela de origem inválida.';
 end if;
 insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body)
  values(new.company_id,contact,card_id,actor,actor_label,event_kind,event_title,event_body);
 return new;
end;
$$;
revoke all on function crm_private.log_contact_history() from public,anon,authenticated,service_role;
create trigger contact_history_log after insert or update on public.crm_contacts for each row execute function crm_private.log_contact_history();
create trigger opportunity_history_log after insert or update on public.crm_opportunities for each row execute function crm_private.log_contact_history();

-- Recover only real contact audit entries already recorded; no inferred past stages.
insert into public.crm_contact_history(id,company_id,contact_id,actor_user_id,actor_name,kind,title,body,occurred_at)
 select a.id,a.company_id,c.id,a.actor_user_id,coalesce(left(p.display_name,160),'Sistema'),
  case when a.action='INSERT' then 'contact_created' else 'contact_updated' end,
  case when a.action='INSERT' then 'Contato cadastrado' else 'Cadastro atualizado' end,
  'Registro anterior recuperado da auditoria. O detalhamento dos campos não estava disponível.',a.occurred_at
 from public.crm_audit_events a join public.crm_contacts c on c.company_id=a.company_id and c.id=a.record_id
 left join public.crm_profiles p on p.id=a.actor_user_id
 where a.entity='crm_contacts' and a.action in ('INSERT','UPDATE');

-- Reports preserve underlying RLS and are additionally restricted to company managers.
create view public.crm_contact_activity_report with (security_invoker=true) as
 select c.company_id,c.id as contact_id,c.name,c.phone,c.owner_membership_id,
 coalesce(p.display_name,'Sem responsável') as owner_name,c.created_at,
 max(h.occurred_at) as last_activity_at,
 max(h.occurred_at) filter(where h.kind='whatsapp_opened') as last_whatsapp_at,
 max(h.occurred_at) filter(where h.kind='card_moved') as last_movement_at,
 count(h.id) filter(where h.kind='whatsapp_opened')::integer as whatsapp_count,
 count(h.id) filter(where h.kind='card_moved')::integer as movement_count,
 count(h.id) filter(where h.kind='note')::integer as note_count
 from public.crm_contacts c
 left join public.crm_memberships m on m.id=c.owner_membership_id and m.company_id=c.company_id
 left join public.crm_profiles p on p.id=m.user_id
 left join public.crm_contact_history h on h.company_id=c.company_id and h.contact_id=c.id
 where crm_private.company_role(c.company_id)='manager' and crm_private.has_company_access(c.company_id)
 group by c.company_id,c.id,c.name,c.phone,c.owner_membership_id,p.display_name,c.created_at;
create view public.crm_team_activity_report with (security_invoker=true) as
 select h.company_id,h.actor_user_id as actor_id,(array_agg(h.actor_name order by h.occurred_at desc))[1] as actor_name,
 count(*)::integer as total,
 count(*) filter(where h.kind='whatsapp_opened')::integer as whatsapp_count,
 count(*) filter(where h.kind='card_moved')::integer as movement_count,
 count(*) filter(where h.kind='note')::integer as note_count,
 count(distinct h.contact_id)::integer as contacts_count,
 max(h.occurred_at) as last_activity_at
 from public.crm_contact_history h
 where h.occurred_at>=now()-interval '30 days' and h.actor_user_id is not null
 and crm_private.company_role(h.company_id)='manager' and crm_private.has_company_access(h.company_id)
 group by h.company_id,h.actor_user_id;
revoke all on public.crm_contact_activity_report,public.crm_team_activity_report from public,anon,authenticated,service_role;
grant select on public.crm_contact_activity_report,public.crm_team_activity_report to authenticated;

comment on table public.crm_contact_history is 'Linha do tempo por contato. Notas imutáveis e eventos automáticos; leitura acompanha a permissão atual do contato.';
commit;
