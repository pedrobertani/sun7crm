-- Gestão operacional, identidade e relatórios, sem dados de demonstração.
begin;
alter table public.crm_companies add column row_version bigint not null default 1;
alter table public.crm_memberships add column row_version bigint not null default 1;
alter table public.crm_tasks add column row_version bigint not null default 1,add column opportunity_id uuid,
 add foreign key(company_id,opportunity_id) references public.crm_opportunities(company_id,id);
create index crm_tasks_opportunity_idx on public.crm_tasks(company_id,opportunity_id);
create trigger core_company_version before update on public.crm_companies for each row execute function crm_private.core_touch_version();
create trigger core_membership_version before update on public.crm_memberships for each row execute function crm_private.core_touch_version();
create trigger core_task_version before update on public.crm_tasks for each row execute function crm_private.core_touch_version();

create function crm_private.core_normalize_phone(p_phone text) returns text language plpgsql immutable security invoker set search_path='' as $$
declare n text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
 if n='' then return '';end if;
 if length(n) in (12,13) and left(n,2)='55' then n:=substring(n from 3);end if;
 if n !~ '^[0-9]{2}([2-5][0-9]{7}|9[0-9]{8})$' or left(n,2)<>all(array['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99']) then raise exception 'CRM_INVALID_PHONE' using errcode='22023';end if;
 return n;
end;$$;
revoke all on function crm_private.core_normalize_phone(text) from public,anon,authenticated,service_role;
create function crm_private.core_validate_contact() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.phone is distinct from old.phone then new.phone:=crm_private.core_normalize_phone(new.phone);end if;
 if tg_op='INSERT' or new.owner_membership_id is distinct from old.owner_membership_id then
  perform 1 from public.crm_companies where id=new.company_id for key share;
  perform 1 from public.crm_memberships where company_id=new.company_id and id=new.owner_membership_id and active for key share;
  if not found then raise exception 'CRM_INVALID_OWNER' using errcode='23514';end if;
 end if;return new;
end;$$;
revoke all on function crm_private.core_validate_contact() from public,anon,authenticated,service_role;
create trigger core_validate_contact before insert or update on public.crm_contacts for each row execute function crm_private.core_validate_contact();
create function crm_private.core_validate_task() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.crm_contacts;owner_role text;
begin
 if tg_op='INSERT' or new.owner_membership_id is distinct from old.owner_membership_id then
  perform 1 from public.crm_companies where id=new.company_id for key share;
  perform 1 from public.crm_memberships where company_id=new.company_id and id=new.owner_membership_id and active for key share;
  if not found then raise exception 'CRM_INVALID_OWNER' using errcode='23514';end if;
 end if;
 if new.opportunity_id is not null and not exists(select 1 from public.crm_opportunities where company_id=new.company_id and id=new.opportunity_id and contact_id=new.contact_id) then raise exception 'CRM_INVALID_TASK_CARD' using errcode='23514';end if;
 if new.contact_id is not null then
  select * into c from public.crm_contacts where company_id=new.company_id and id=new.contact_id;
  select role into owner_role from public.crm_memberships where company_id=new.company_id and id=new.owner_membership_id;
  if owner_role='seller' and c.owner_membership_id<>new.owner_membership_id then raise exception 'CRM_TASK_OWNER_MISMATCH' using errcode='23514';end if;
 end if;return new;
end;$$;
revoke all on function crm_private.core_validate_task() from public,anon,authenticated,service_role;
create trigger core_validate_task before insert or update on public.crm_tasks for each row execute function crm_private.core_validate_task();
-- Trocar responsáveis usa os comandos abaixo, com bloqueio ordenado por empresa.
revoke update(owner_membership_id) on public.crm_contacts,public.crm_tasks from authenticated;
grant insert(opportunity_id),update(opportunity_id) on public.crm_tasks to authenticated;
drop policy tasks_read on public.crm_tasks;
create policy tasks_read on public.crm_tasks for select to authenticated using(
 crm_private.has_company_access(company_id) and (crm_private.company_role(company_id)='manager' or crm_private.owns_membership(company_id,owner_membership_id))
 and (contact_id is null or crm_private.can_read_contact(company_id,contact_id)));

create function crm_private.workspace_save_contact(p_company uuid,p_contact uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.crm_contacts;result public.crm_contacts;owner uuid;role text;items uuid[];item uuid;normalized_phone text;
begin
 role:=crm_private.company_role(p_company);
 if not crm_private.has_company_access(p_company) or role not in ('manager','seller') then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['name','phone','email','temperature','interests','notes','owner_membership_id','catalog_ids'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for key share;
 if p_contact is not null then
  select * into old_row from public.crm_contacts where company_id=p_company and id=p_contact for update;
  if not found or not crm_private.can_write_contact(p_company,p_contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or old_row.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 owner:=coalesce((p_values->>'owner_membership_id')::uuid,old_row.owner_membership_id,(select id from public.crm_memberships where company_id=p_company and user_id=(select auth.uid()) and active));
 if role='seller' and not crm_private.owns_membership(p_company,owner) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if not crm_private.active_membership(p_company,owner) then raise exception 'CRM_INVALID_OWNER' using errcode='22023';end if;
 if p_values ? 'phone' then normalized_phone:=crm_private.core_normalize_phone(p_values->>'phone');else normalized_phone:=coalesce(old_row.phone,'');end if;
 if coalesce(p_values->>'email',old_row.email,'')<>'' and coalesce(p_values->>'email',old_row.email) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'CRM_INVALID_EMAIL' using errcode='22023';end if;
 if p_values ? 'catalog_ids' and jsonb_typeof(p_values->'catalog_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 if p_values ? 'catalog_ids' then select coalesce(array_agg(distinct x::uuid),'{}') into items from jsonb_array_elements_text(p_values->'catalog_ids') x;
 else select coalesce(array_agg(catalog_id),'{}') into items from public.crm_contact_catalog where company_id=p_company and contact_id=p_contact;end if;
 foreach item in array items loop
  if not exists(select 1 from public.crm_catalog_items ci where company_id=p_company and id=item and (active or exists(select 1 from public.crm_contact_catalog where company_id=p_company and contact_id=p_contact and catalog_id=item))) then raise exception 'CRM_INVALID_CATALOG_ITEM' using errcode='22023';end if;
 end loop;
 if p_contact is null then
  insert into public.crm_contacts(company_id,owner_membership_id,name,phone,email,temperature,interests,notes)
  values(p_company,owner,btrim(p_values->>'name'),normalized_phone,lower(btrim(coalesce(p_values->>'email',''))),coalesce(p_values->>'temperature','unclassified'),coalesce(p_values->>'interests',''),coalesce(p_values->>'notes','')) returning * into result;
 else
  update public.crm_contacts set owner_membership_id=owner,name=coalesce(btrim(p_values->>'name'),old_row.name),phone=normalized_phone,email=coalesce(lower(btrim(p_values->>'email')),old_row.email),temperature=coalesce(p_values->>'temperature',old_row.temperature),interests=coalesce(p_values->>'interests',old_row.interests),notes=coalesce(p_values->>'notes',old_row.notes) where id=p_contact returning * into result;
 end if;
 if p_contact is not null and owner is distinct from old_row.owner_membership_id then
  update public.crm_tasks set owner_membership_id=owner where company_id=p_company and contact_id=p_contact and owner_membership_id=old_row.owner_membership_id and status<>'done';
 end if;
 delete from public.crm_contact_catalog where company_id=p_company and contact_id=result.id and not(catalog_id=any(items));
 insert into public.crm_contact_catalog(company_id,contact_id,catalog_id) select p_company,result.id,x from unnest(items) x where not exists(select 1 from public.crm_contact_catalog where company_id=p_company and contact_id=result.id and catalog_id=x);
 return to_jsonb(result)||jsonb_build_object('catalog_ids',to_jsonb(items));
end;
$$;

create function crm_private.workspace_save_task(p_company uuid,p_task uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.crm_tasks;result public.crm_tasks;role text;owner uuid;contact uuid;card uuid;
begin
 role:=crm_private.company_role(p_company);
 if not crm_private.has_company_access(p_company) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['owner_membership_id','contact_id','opportunity_id','title','due_date','status'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for key share;
 if p_task is not null then
  select * into old_row from public.crm_tasks where company_id=p_company and id=p_task for update;
  if not found or not(role='manager' or crm_private.owns_membership(p_company,old_row.owner_membership_id)) or (old_row.contact_id is not null and not crm_private.can_read_contact(p_company,old_row.contact_id)) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or old_row.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 owner:=coalesce((p_values->>'owner_membership_id')::uuid,old_row.owner_membership_id,(select id from public.crm_memberships where company_id=p_company and user_id=(select auth.uid()) and active));
 if role<>'manager' and not crm_private.owns_membership(p_company,owner) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_values ? 'opportunity_id' then card:=(p_values->>'opportunity_id')::uuid;else card:=old_row.opportunity_id;end if;
 if p_values ? 'contact_id' then contact:=(p_values->>'contact_id')::uuid;else contact:=old_row.contact_id;end if;
 if card is not null then
  if contact is null then select contact_id into contact from public.crm_opportunities where company_id=p_company and id=card;end if;
  if not exists(select 1 from public.crm_opportunities where company_id=p_company and id=card and contact_id=contact) then raise exception 'CRM_INVALID_TASK_CARD' using errcode='22023';end if;
 end if;
 if contact is not null and not crm_private.can_read_contact(p_company,contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_task is null then
  insert into public.crm_tasks(company_id,owner_membership_id,contact_id,opportunity_id,title,due_date,status)
  values(p_company,owner,contact,card,btrim(p_values->>'title'),(p_values->>'due_date')::date,coalesce(p_values->>'status','todo')) returning * into result;
 else
  update public.crm_tasks set owner_membership_id=owner,contact_id=contact,opportunity_id=card,title=coalesce(btrim(p_values->>'title'),old_row.title),due_date=coalesce((p_values->>'due_date')::date,old_row.due_date),status=coalesce(p_values->>'status',old_row.status) where id=p_task returning * into result;
 end if;return to_jsonb(result);
end;
$$;

create function crm_private.workspace_team_members(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform crm_private.core_require_manager(p_company);
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'active',m.active,'row_version',m.row_version,'display_name',p.display_name,'email',u.email) order by p.display_name),'[]') into result
 from public.crm_memberships m join public.crm_profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where m.company_id=p_company;
 return result;
end;
$$;

create function crm_private.workspace_update_team_member(p_company uuid,p_membership uuid,p_values jsonb,p_reassign_to uuid,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.crm_memberships;target public.crm_memberships;next_active boolean;next_role text;next_name text;
begin
 perform crm_private.core_require_manager(p_company);
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['display_name','role','active'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for update;
 select * into member from public.crm_memberships where company_id=p_company and id=p_membership for update;
 if not found or member.role='manager' or member.user_id=(select auth.uid()) or exists(select 1 from crm_private.platform_admins where user_id=member.user_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_expected_version is null or member.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 next_active:=coalesce((p_values->>'active')::boolean,member.active);next_role:=coalesce(p_values->>'role',member.role);
 if next_role not in ('seller','reception') then raise exception 'CRM_INVALID_ROLE' using errcode='22023';end if;
 if p_values ? 'display_name' then
  next_name:=btrim(p_values->>'display_name');
  if next_name is null or length(next_name) not between 1 and 160 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  if exists(select 1 from public.crm_memberships where user_id=member.user_id and company_id<>p_company) and next_name is distinct from (select display_name from public.crm_profiles where id=member.user_id) then raise exception 'CRM_SHARED_IDENTITY' using errcode='23514';end if;
 end if;
 if not next_active and member.active then
  if exists(select 1 from public.crm_contacts where company_id=p_company and owner_membership_id=member.id) or exists(select 1 from public.crm_tasks where company_id=p_company and owner_membership_id=member.id and status<>'done') then
   select * into target from public.crm_memberships where company_id=p_company and id=p_reassign_to and active and id<>member.id and role in ('manager','seller') for key share;
   if not found then raise exception 'CRM_REASSIGNMENT_REQUIRED' using errcode='23514';end if;
   update public.crm_contacts set owner_membership_id=target.id where company_id=p_company and owner_membership_id=member.id;
   update public.crm_tasks set owner_membership_id=target.id where company_id=p_company and owner_membership_id=member.id and status<>'done';
  end if;
 end if;
 if next_name is not null then update public.crm_profiles set display_name=next_name where id=member.user_id;end if;
 update public.crm_memberships set active=next_active,role=next_role where id=member.id returning * into member;
 return to_jsonb(member);
end;
$$;

create function crm_private.workspace_update_company_brand(p_company uuid,p_values jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_companies;logo text;
begin
 perform crm_private.core_require_manager(p_company);
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['display_name','theme','logo_path'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 select * into c from public.crm_companies where id=p_company for update;
 if p_expected_version is null or p_expected_version<>c.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if p_values ? 'logo_path' then logo:=p_values->>'logo_path';else logo:=c.logo_path;end if;
 if logo is not null then
  if logo not like p_company::text||'/%' or logo ~ '(^|/)\.\.(/|$)' then raise exception 'CRM_INVALID_LOGO' using errcode='22023';end if;
  if to_regclass('storage.objects') is null then raise exception 'CRM_LOGO_UNAVAILABLE' using errcode='22023';end if;
  if not exists(select 1 from storage.objects where bucket_id='crm-company-logos' and name=logo) then raise exception 'CRM_INVALID_LOGO' using errcode='22023';end if;
 end if;
 update public.crm_companies set display_name=case when p_values ? 'display_name' then nullif(btrim(p_values->>'display_name'),'') else c.display_name end,theme=coalesce(p_values->>'theme',c.theme),logo_path=logo where id=p_company returning * into c;
 return to_jsonb(c);
end;
$$;
revoke all on function crm_private.workspace_save_contact(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.workspace_save_contact(uuid,uuid,jsonb,bigint) to authenticated;
create function public.crm_save_contact(p_company uuid,p_contact uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language sql security invoker set search_path='' as $$select crm_private.workspace_save_contact(p_company,p_contact,p_values,p_expected_version);$$;
revoke all on function public.crm_save_contact(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_contact(uuid,uuid,jsonb,bigint) to authenticated;
revoke all on function crm_private.workspace_save_task(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.workspace_save_task(uuid,uuid,jsonb,bigint) to authenticated;
create function public.crm_save_task(p_company uuid,p_task uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language sql security invoker set search_path='' as $$select crm_private.workspace_save_task(p_company,p_task,p_values,p_expected_version);$$;
revoke all on function public.crm_save_task(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_task(uuid,uuid,jsonb,bigint) to authenticated;
revoke all on function crm_private.workspace_team_members(uuid) from public,anon,authenticated,service_role;
grant execute on function crm_private.workspace_team_members(uuid) to authenticated;
create function public.crm_team_members(p_company uuid) returns jsonb language sql security invoker set search_path='' as $$select crm_private.workspace_team_members(p_company);$$;
revoke all on function public.crm_team_members(uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_team_members(uuid) to authenticated;
revoke all on function crm_private.workspace_update_team_member(uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.workspace_update_team_member(uuid,uuid,jsonb,uuid,bigint) to authenticated;
create function public.crm_update_team_member(p_company uuid,p_membership uuid,p_values jsonb,p_reassign_to uuid,p_expected_version bigint) returns jsonb language sql security invoker set search_path='' as $$select crm_private.workspace_update_team_member(p_company,p_membership,p_values,p_reassign_to,p_expected_version);$$;
revoke all on function public.crm_update_team_member(uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_update_team_member(uuid,uuid,jsonb,uuid,bigint) to authenticated;
revoke all on function crm_private.workspace_update_company_brand(uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.workspace_update_company_brand(uuid,jsonb,bigint) to authenticated;
create function public.crm_update_company_brand(p_company uuid,p_values jsonb,p_expected_version bigint) returns jsonb language sql security invoker set search_path='' as $$select crm_private.workspace_update_company_brand(p_company,p_values,p_expected_version);$$;
revoke all on function public.crm_update_company_brand(uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_update_company_brand(uuid,jsonb,bigint) to authenticated;

-- Painel da empresa: as consultas executam como o usuário, preservando toda a RLS.
create function public.crm_workspace_metrics(p_company uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not crm_private.has_company_access(p_company) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'CRM_INVALID_RANGE' using errcode='22023';end if;
 select jsonb_build_object(
 'contacts',(select count(*) from public.crm_contacts where company_id=p_company and (created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to),
 'hot_contacts',(select count(*) from public.crm_contacts where company_id=p_company and temperature='hot' and (created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to),
 'open_cards',(select count(*) from public.crm_opportunities where company_id=p_company and not is_closed),
 'estimated_pipeline_cents',(select coalesce(sum(value_cents),0) from public.crm_opportunities where company_id=p_company and not is_closed),
 'pending_tasks',(select count(*) from public.crm_tasks where company_id=p_company and status<>'done'),
 'overdue_tasks',(select count(*) from public.crm_tasks where company_id=p_company and status<>'done' and due_date<(statement_timestamp() at time zone 'America/Sao_Paulo')::date),
 'contacts_by_day',(select coalesce(jsonb_agg(to_jsonb(x) order by x.day),'[]') from (select (created_at at time zone 'America/Sao_Paulo')::date as day,count(*) as count from public.crm_contacts where company_id=p_company and (created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to group by 1) x),
 'cards_by_stage',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select o.board_id,o.stage_id,count(*) as count,coalesce(sum(o.value_cents),0) as estimated_cents from public.crm_opportunities o where o.company_id=p_company and not o.is_closed group by o.board_id,o.stage_id) x),
 'cards_by_strategy',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select o.strategy_id,count(*) as count,coalesce(sum(o.value_cents),0) as estimated_cents from public.crm_opportunities o where o.company_id=p_company and (o.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to group by o.strategy_id) x)
 ) into result;return result;
end;$$;
revoke all on function public.crm_workspace_metrics(uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function public.crm_workspace_metrics(uuid,date,date) to authenticated;
create view public.crm_campaign_category_metrics with(security_invoker=true) as
 select company_id,campaign_id,category,count(*) as participants,sum(indicated_count) as indications,sum(attended_count) as attended,
 sum(paid_count) as paid,sum(eligible_cents) as eligible_cents,sum(amount_cents) as commission_cents,sum(paid_cents) as settled_cents
 from public.crm_ambassador_campaign_totals group by company_id,campaign_id,category;
revoke all on public.crm_campaign_category_metrics from public,anon,authenticated,service_role;
grant select on public.crm_campaign_category_metrics to authenticated;

-- Logos privados. A política conhece somente o prefixo da própria empresa, sem bucket público.
create function crm_private.can_access_company_logo(p_name text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare company uuid;prefix text:=split_part(p_name,'/',1);
begin
 if prefix !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' or p_name ~ '(^|/)\.\.(/|$)' then return false;end if;
 company:=prefix::uuid;
 return crm_private.has_company_access(company) and (not p_write or crm_private.company_role(company)='manager');
end;$$;
revoke all on function crm_private.can_access_company_logo(text,boolean) from public,anon,authenticated,service_role;
grant execute on function crm_private.can_access_company_logo(text,boolean) to authenticated;
do $$begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  if exists(select 1 from storage.buckets where id='crm-company-logos' and public) then raise exception 'CRM_LOGO_BUCKET_CONFLICT';end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   values('crm-company-logos','crm-company-logos',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
  execute $policy$create policy crm_logos_read on storage.objects for select to authenticated using(bucket_id='crm-company-logos' and crm_private.can_access_company_logo(name,false))$policy$;
  execute $policy$create policy crm_logos_insert on storage.objects for insert to authenticated with check(bucket_id='crm-company-logos' and crm_private.can_access_company_logo(name,true))$policy$;
  execute $policy$create policy crm_logos_update on storage.objects for update to authenticated using(bucket_id='crm-company-logos' and crm_private.can_access_company_logo(name,true)) with check(bucket_id='crm-company-logos' and crm_private.can_access_company_logo(name,true))$policy$;
  execute $policy$create policy crm_logos_delete on storage.objects for delete to authenticated using(bucket_id='crm-company-logos' and crm_private.can_access_company_logo(name,true))$policy$;
 end if;
end;$$;
revoke update(display_name,theme,logo_path) on public.crm_companies from authenticated;
commit;
