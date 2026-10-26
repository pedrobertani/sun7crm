begin;
alter table public.crm_opportunities add column archived_at timestamptz;
-- Explicit per-membership permissions. Legacy defaults stay in place until edited.
create table crm_private.permission_catalog(key text primary key);
insert into crm_private.permission_catalog(key) values ('cards.view'),('cards.create'),('cards.edit'),('cards.delete'),('boards.view'),('boards.create'),('boards.edit'),('stages.create'),('stages.edit'),('stages.reorder'),('stages.delete'),('contacts.view'),('contacts.create'),('contacts.edit'),('contacts.import'),('contacts.export'),('history.view'),('history.create'),('history.whatsapp'),('tasks.view'),('tasks.create'),('tasks.edit'),('catalog.view'),('catalog.create'),('catalog.edit'),('labels.view'),('labels.create'),('labels.edit'),('strategies.view'),('strategies.create'),('strategies.edit'),('ambassadors.view'),('ambassadors.create'),('ambassadors.edit'),('campaigns.view'),('campaigns.create'),('campaigns.edit'),('campaigns.close'),('campaigns.pay'),('referrals.view'),('referrals.create'),('referrals.edit'),('referrals.adjust'),('dashboard.view'),('reports.view'),('team.view'),('team.manage'),('settings.view'),('settings.edit'),('plan.view');
create table crm_private.permission_audit (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.crm_companies(id), membership_id uuid not null references public.crm_memberships(id), actor_user_id uuid not null references auth.users(id), before_data jsonb not null, after_data jsonb not null, occurred_at timestamptz not null default statement_timestamp()
);
alter table crm_private.permission_audit enable row level security;
revoke all on crm_private.permission_audit from public,anon,authenticated,service_role;
create table crm_private.employee_access (
 membership_id uuid primary key references public.crm_memberships(id) on delete cascade,
 keys text[] not null default '{}', scope text not null check(scope in ('own','company')),
 version bigint not null default 1, updated_at timestamptz not null default statement_timestamp(),
 updated_by uuid references auth.users(id)
);
create index permission_audit_company_time_idx on crm_private.permission_audit(company_id,occurred_at desc);
create index permission_audit_member_idx on crm_private.permission_audit(membership_id);
create index permission_audit_actor_idx on crm_private.permission_audit(actor_user_id);
create index employee_access_updated_by_idx on crm_private.employee_access(updated_by);
alter table crm_private.permission_catalog enable row level security;
alter table crm_private.employee_access enable row level security;
revoke all on crm_private.permission_catalog,crm_private.employee_access from public,anon,authenticated,service_role;
create function crm_private.member_permission(p_member uuid,p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when a.membership_id is not null then p_key=any(a.keys)
 when m.role='manager' then true
 when p_key in ('boards.view','catalog.view','labels.view','strategies.view','dashboard.view') then true
 when m.role='seller' then split_part(p_key,'.',1) in ('cards','contacts','history','tasks') and p_key<>'cards.delete'
 else p_key in ('cards.view','contacts.view','history.view','history.whatsapp','tasks.view','tasks.create','tasks.edit') end
 from public.crm_memberships m join public.crm_companies c on c.id=m.company_id
 left join crm_private.employee_access a on a.membership_id=m.id
 where m.id=p_member and m.active and c.enabled and exists(select 1 from crm_private.permission_catalog where key=p_key)),false);
$$;
create function crm_private.has_permission(p_company uuid,p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select (crm_private.has_company_access(p_company) or (p_key='plan.view' and crm_private.has_current_acceptance() and crm_private.company_role(p_company) is not null)) and coalesce((select crm_private.member_permission(m.id,p_key)
 from public.crm_memberships m where m.company_id=p_company and m.user_id=(select auth.uid()) and m.active),false);
$$;
create function crm_private.member_company_scope(p_member uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select coalesce(a.scope='company',m.role in ('manager','reception')) from public.crm_memberships m
 left join crm_private.employee_access a on a.membership_id=m.id where m.id=p_member and m.active),false);
$$;
create function crm_private.has_company_scope(p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select crm_private.has_company_access(p_company) and coalesce((select crm_private.member_company_scope(m.id) from public.crm_memberships m where m.company_id=p_company and m.user_id=(select auth.uid()) and m.active),false);
$$;
create function crm_private.permission_contact_scope(p_company uuid,p_contact uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select crm_private.has_company_access(p_company) and exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_contact
 and (crm_private.has_company_scope(p_company) or crm_private.owns_membership(p_company,c.owner_membership_id)));
$$;
create or replace function crm_private.can_read_contact(target_company uuid,target_contact uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select crm_private.has_permission(target_company,'contacts.view') and crm_private.permission_contact_scope(target_company,target_contact);
$$;
create or replace function crm_private.can_write_contact(target_company uuid,target_contact uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select crm_private.has_permission(target_company,'contacts.edit') and crm_private.permission_contact_scope(target_company,target_contact);
$$;
create function crm_private.require_permission(p_company uuid,p_key text) returns void
language plpgsql stable security invoker set search_path='' as $$begin
 if not crm_private.has_permission(p_company,p_key) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
end;$$;
create function public.crm_employee_permissions(p_company uuid,p_membership uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare member public.crm_memberships;result jsonb;
begin
 if not crm_private.has_current_acceptance() or crm_private.company_role(p_company) is null then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 select * into member from public.crm_memberships where company_id=p_company and ((p_membership is not null and id=p_membership) or (p_membership is null and user_id=(select auth.uid())));
 if not found or (member.user_id<>(select auth.uid()) and not crm_private.has_permission(p_company,'team.manage')) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 select jsonb_build_object('keys',coalesce((select to_jsonb(a.keys) from crm_private.employee_access a where a.membership_id=member.id),(select jsonb_agg(key order by key) from crm_private.permission_catalog where crm_private.member_permission(member.id,key)),'[]'),
 'scope',coalesce((select a.scope from crm_private.employee_access a where a.membership_id=member.id),case when member.role in ('manager','reception') then 'company' else 'own' end),'version',coalesce((select version from crm_private.employee_access where membership_id=member.id),0)) into result;
 return result;
end;$$;
create function public.crm_set_employee_permissions(p_company uuid,p_membership uuid,p_keys text[],p_scope text,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member public.crm_memberships;current_version bigint;before_value jsonb;
begin
 perform crm_private.require_permission(p_company,'team.manage');
 -- Serialize grant/revoke operations within the company, including a concurrent administrator revocation.
 perform 1 from public.crm_companies where id=p_company for update;
 perform crm_private.require_permission(p_company,'team.manage');
 select * into member from public.crm_memberships where company_id=p_company and id=p_membership for update;
 if not found or member.user_id=(select auth.uid()) or member.role='manager' or exists(select 1 from crm_private.platform_admins where user_id=member.user_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_scope is null or p_scope not in ('own','company') or p_keys is null or array_position(p_keys,null) is not null or cardinality(p_keys)>100 or exists(select 1 from unnest(p_keys) k where not exists(select 1 from crm_private.permission_catalog c where c.key=k)) then raise exception 'CRM_INVALID_PERMISSIONS' using errcode='22023';end if;
 -- A delegated administrator can grant only capabilities and scope they themselves hold.
 if exists(select 1 from unnest(p_keys) k where not crm_private.has_permission(p_company,k)) or (p_scope='company' and not crm_private.has_company_scope(p_company)) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if exists(select 1 from unnest(p_keys) k where split_part(k,'.',2)<>'view' and exists(select 1 from crm_private.permission_catalog c where c.key=split_part(k,'.',1)||'.view') and not (split_part(k,'.',1)||'.view'=any(p_keys))) then raise exception 'CRM_PERMISSION_REQUIRES_VIEW' using errcode='22023';end if;
 if exists(select 1 from (values
 ('cards.view','contacts.view'),('cards.view','boards.view'),
 ('stages.create','boards.view'),('stages.edit','boards.view'),('stages.reorder','boards.view'),('stages.delete','boards.view'),
 ('history.view','contacts.view'),('reports.view','contacts.view'),('reports.view','cards.view'),('reports.view','history.view'),('reports.view','boards.view'),
 ('ambassadors.view','contacts.view'),('referrals.view','campaigns.view'),('referrals.view','ambassadors.view'),('referrals.view','cards.view')
 ) d(key,required) where d.key=any(p_keys) and not(d.required=any(p_keys))) then raise exception 'CRM_PERMISSION_REQUIRES_VIEW' using errcode='22023';end if;
 select coalesce((select version from crm_private.employee_access where membership_id=member.id),0) into current_version;
 if p_expected_version is null or p_expected_version<>current_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 before_value:=public.crm_employee_permissions(p_company,member.id);
 insert into crm_private.employee_access(membership_id,keys,scope,updated_by) values(member.id,array(select distinct unnest(p_keys) order by 1),p_scope,(select auth.uid()))
 on conflict(membership_id) do update set keys=excluded.keys,scope=excluded.scope,version=crm_private.employee_access.version+1,updated_at=statement_timestamp(),updated_by=(select auth.uid());
 insert into crm_private.permission_audit(company_id,membership_id,actor_user_id,before_data,after_data) values(p_company,member.id,(select auth.uid()),before_value,public.crm_employee_permissions(p_company,member.id));
 return public.crm_employee_permissions(p_company,member.id);
end;$$;

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_contacts' loop execute format('drop policy %I on public.crm_contacts',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_contacts for select to authenticated using(crm_private.has_permission(company_id,'contacts.view') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id))));
create policy permissions_insert on public.crm_contacts for insert to authenticated with check(crm_private.has_permission(company_id,'contacts.create') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id))) and (crm_private.active_membership(company_id,owner_membership_id)));
create policy permissions_update on public.crm_contacts for update to authenticated using(crm_private.has_permission(company_id,'contacts.edit') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id))) and (crm_private.active_membership(company_id,owner_membership_id))) with check(crm_private.has_permission(company_id,'contacts.edit') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id))) and (crm_private.active_membership(company_id,owner_membership_id)));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_opportunities' loop execute format('drop policy %I on public.crm_opportunities',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_opportunities for select to authenticated using(crm_private.has_permission(company_id,'cards.view') and (crm_private.permission_contact_scope(company_id,contact_id)));
create policy permissions_insert on public.crm_opportunities for insert to authenticated with check(crm_private.has_permission(company_id,'cards.create') and (crm_private.permission_contact_scope(company_id,contact_id)) and (true));
create policy permissions_update on public.crm_opportunities for update to authenticated using(crm_private.has_permission(company_id,'cards.edit') and (crm_private.permission_contact_scope(company_id,contact_id)) and (true)) with check(crm_private.has_permission(company_id,'cards.edit') and (crm_private.permission_contact_scope(company_id,contact_id)) and (true));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_tasks' loop execute format('drop policy %I on public.crm_tasks',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_tasks for select to authenticated using(crm_private.has_permission(company_id,'tasks.view') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id)) and (contact_id is null or crm_private.permission_contact_scope(company_id,contact_id))));
create policy permissions_insert on public.crm_tasks for insert to authenticated with check(crm_private.has_permission(company_id,'tasks.create') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id)) and (contact_id is null or crm_private.permission_contact_scope(company_id,contact_id))) and (crm_private.active_membership(company_id,owner_membership_id)));
create policy permissions_update on public.crm_tasks for update to authenticated using(crm_private.has_permission(company_id,'tasks.edit') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id)) and (contact_id is null or crm_private.permission_contact_scope(company_id,contact_id))) and (crm_private.active_membership(company_id,owner_membership_id))) with check(crm_private.has_permission(company_id,'tasks.edit') and ((crm_private.has_company_scope(company_id) or crm_private.owns_membership(company_id,owner_membership_id)) and (contact_id is null or crm_private.permission_contact_scope(company_id,contact_id))) and (crm_private.active_membership(company_id,owner_membership_id)));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_catalog_items' loop execute format('drop policy %I on public.crm_catalog_items',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_catalog_items for select to authenticated using(crm_private.has_permission(company_id,'catalog.view') and (true));
create policy permissions_insert on public.crm_catalog_items for insert to authenticated with check(crm_private.has_permission(company_id,'catalog.create') and (true) and (true));
create policy permissions_update on public.crm_catalog_items for update to authenticated using(crm_private.has_permission(company_id,'catalog.edit') and (true) and (true)) with check(crm_private.has_permission(company_id,'catalog.edit') and (true) and (true));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_labels' loop execute format('drop policy %I on public.crm_labels',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_labels for select to authenticated using(crm_private.has_permission(company_id,'labels.view') and (true));
create policy permissions_insert on public.crm_labels for insert to authenticated with check(crm_private.has_permission(company_id,'labels.create') and (true) and (true));
create policy permissions_update on public.crm_labels for update to authenticated using(crm_private.has_permission(company_id,'labels.edit') and (true) and (true)) with check(crm_private.has_permission(company_id,'labels.edit') and (true) and (true));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_strategies' loop execute format('drop policy %I on public.crm_strategies',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_strategies for select to authenticated using(crm_private.has_permission(company_id,'strategies.view') and (true));
create policy permissions_insert on public.crm_strategies for insert to authenticated with check(crm_private.has_permission(company_id,'strategies.create') and (true) and (true));
create policy permissions_update on public.crm_strategies for update to authenticated using(crm_private.has_permission(company_id,'strategies.edit') and (true) and (true)) with check(crm_private.has_permission(company_id,'strategies.edit') and (true) and (true));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_ambassadors' loop execute format('drop policy %I on public.crm_ambassadors',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_ambassadors for select to authenticated using(crm_private.has_permission(company_id,'ambassadors.view') and (crm_private.permission_contact_scope(company_id,contact_id)));
create policy permissions_insert on public.crm_ambassadors for insert to authenticated with check(crm_private.has_permission(company_id,'ambassadors.create') and (crm_private.permission_contact_scope(company_id,contact_id)) and (crm_private.permission_contact_scope(company_id,contact_id)));
create policy permissions_update on public.crm_ambassadors for update to authenticated using(crm_private.has_permission(company_id,'ambassadors.edit') and (crm_private.permission_contact_scope(company_id,contact_id)) and (crm_private.permission_contact_scope(company_id,contact_id))) with check(crm_private.has_permission(company_id,'ambassadors.edit') and (crm_private.permission_contact_scope(company_id,contact_id)) and (crm_private.permission_contact_scope(company_id,contact_id)));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_ambassador_metrics' loop execute format('drop policy %I on public.crm_ambassador_metrics',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_ambassador_metrics for select to authenticated using(crm_private.has_permission(company_id,'ambassadors.view') and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)));
create policy permissions_insert on public.crm_ambassador_metrics for insert to authenticated with check(crm_private.has_permission(company_id,'ambassadors.create') and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)) and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)));
create policy permissions_update on public.crm_ambassador_metrics for update to authenticated using(crm_private.has_permission(company_id,'ambassadors.edit') and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)) and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id))) with check(crm_private.has_permission(company_id,'ambassadors.edit') and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)) and (exists(select 1 from public.crm_ambassadors a where a.company_id=crm_ambassador_metrics.company_id and a.id=crm_ambassador_metrics.ambassador_id)));

do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_ambassador_campaigns' loop execute format('drop policy %I on public.crm_ambassador_campaigns',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_ambassador_campaigns for select to authenticated using(crm_private.has_permission(company_id,'campaigns.view') and (true));
create policy permissions_insert on public.crm_ambassador_campaigns for insert to authenticated with check(crm_private.has_permission(company_id,'campaigns.create') and (true) and (true));
create policy permissions_update on public.crm_ambassador_campaigns for update to authenticated using(crm_private.has_permission(company_id,'campaigns.edit') and (true) and (true)) with check(crm_private.has_permission(company_id,'campaigns.edit') and (true) and (true));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_boards' loop execute format('drop policy %I on public.crm_boards',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_boards for select to authenticated using(crm_private.has_permission(company_id,'boards.view'));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_stages' loop execute format('drop policy %I on public.crm_stages',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_stages for select to authenticated using(crm_private.has_permission(company_id,'boards.view'));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_ambassador_referrals' loop execute format('drop policy %I on public.crm_ambassador_referrals',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_ambassador_referrals for select to authenticated using(crm_private.has_permission(company_id,'referrals.view') and crm_private.permission_contact_scope(company_id,contact_id));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_referral_catalog' loop execute format('drop policy %I on public.crm_referral_catalog',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_referral_catalog for select to authenticated using(crm_private.has_permission(company_id,'referrals.view') and exists(select 1 from public.crm_ambassador_referrals r where r.company_id=crm_referral_catalog.company_id and r.id=crm_referral_catalog.referral_id));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_referral_revisions' loop execute format('drop policy %I on public.crm_referral_revisions',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_referral_revisions for select to authenticated using(crm_private.has_permission(company_id,'referrals.view') and exists(select 1 from public.crm_ambassador_referrals r where r.company_id=crm_referral_revisions.company_id and r.id=crm_referral_revisions.referral_id));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_campaign_participants' loop execute format('drop policy %I on public.crm_campaign_participants',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_campaign_participants for select to authenticated using(crm_private.has_permission(company_id,'campaigns.view') and exists(select 1 from public.crm_ambassadors a where a.company_id=crm_campaign_participants.company_id and a.id=crm_campaign_participants.ambassador_id));
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_campaign_payments' loop execute format('drop policy %I on public.crm_campaign_payments',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_campaign_payments for select to authenticated using(crm_private.has_permission(company_id,'campaigns.view') and exists(select 1 from public.crm_ambassadors a where a.company_id=crm_campaign_payments.company_id and a.id=crm_campaign_payments.ambassador_id));
drop policy contact_history_read on public.crm_contact_history;
create policy contact_history_read on public.crm_contact_history for select to authenticated using(crm_private.has_permission(company_id,'history.view') and crm_private.permission_contact_scope(company_id,contact_id));
drop policy contact_history_note_insert on public.crm_contact_history;
create policy contact_history_note_insert on public.crm_contact_history for insert to authenticated with check(actor_user_id=(select auth.uid()) and crm_private.permission_contact_scope(company_id,contact_id) and ((kind='note' and crm_private.has_permission(company_id,'history.create')) or (kind='whatsapp_opened' and crm_private.has_permission(company_id,'history.whatsapp'))));

create or replace function crm_private.core_create_board(p_company uuid,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.crm_boards;stage uuid;
begin
 perform crm_private.require_permission(p_company,'boards.create');
 if p_name is null or length(btrim(p_name)) not between 1 and 100 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for update;
 if exists(select 1 from public.crm_boards where company_id=p_company and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'CRM_NAME_EXISTS' using errcode='23505';end if;
 insert into public.crm_boards(company_id,kind,name,position) select p_company,'custom',btrim(p_name),coalesce(max(position)+1,0) from public.crm_boards where company_id=p_company returning * into result;
 insert into public.crm_stages(company_id,board_id,name,position) values(p_company,result.id,'Novo card',0) returning id into stage;
 return to_jsonb(result)||jsonb_build_object('stages',jsonb_build_array(jsonb_build_object('id',stage,'name','Novo card','position',0)));
end;
$$;

create or replace function crm_private.core_configure_board(p_company uuid,p_board uuid,p_name text,p_stages jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare board public.crm_boards;old_stages jsonb;item record;removed record;target uuid;new_ids uuid[];
begin
 if not crm_private.has_company_access(p_company) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if not (crm_private.has_permission(p_company,'boards.edit') or crm_private.has_permission(p_company,'stages.create') or crm_private.has_permission(p_company,'stages.edit') or crm_private.has_permission(p_company,'stages.reorder') or crm_private.has_permission(p_company,'stages.delete')) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 select * into board from public.crm_boards where company_id=p_company and id=p_board for update;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if p_expected_version is null or p_expected_version<>board.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or jsonb_typeof(p_stages) is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 if jsonb_array_length(p_stages) not between 1 and 10 or exists(select 1 from jsonb_array_elements(p_stages) x where jsonb_typeof(x) is distinct from 'object' or x->>'id' is null or x->>'name' is null or length(btrim(x->>'name')) not between 1 and 50)
 or (select count(distinct lower(btrim(x->>'name'))) from jsonb_array_elements(p_stages) x)<>jsonb_array_length(p_stages) then raise exception 'CRM_INVALID_STAGES' using errcode='22023';end if;
 select array_agg((x->>'id')::uuid) into new_ids from jsonb_array_elements(p_stages) x;
 if (select count(distinct n) from unnest(new_ids) n)<>cardinality(new_ids) then raise exception 'CRM_INVALID_STAGES' using errcode='22023';end if;
 if exists(select 1 from public.crm_stages where id=any(new_ids) and (company_id<>p_company or board_id<>p_board)) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if exists(select 1 from public.crm_boards where company_id=p_company and id<>p_board and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'CRM_NAME_EXISTS' using errcode='23505';end if;
 select jsonb_agg(jsonb_build_object('id',id,'position',position) order by position) into old_stages from public.crm_stages where company_id=p_company and board_id=p_board;
 if p_name is distinct from board.name then perform crm_private.require_permission(p_company,'boards.edit');end if;
 if exists(select 1 from jsonb_array_elements(p_stages) x where not exists(select 1 from public.crm_stages s where s.company_id=p_company and s.board_id=p_board and s.id=(x->>'id')::uuid)) then perform crm_private.require_permission(p_company,'stages.create');end if;
 if exists(select 1 from public.crm_stages s where s.company_id=p_company and s.board_id=p_board and not(s.id=any(new_ids))) then perform crm_private.require_permission(p_company,'stages.delete');end if;
 if exists(select 1 from jsonb_array_elements(p_stages) x join public.crm_stages s on s.company_id=p_company and s.board_id=p_board and s.id=(x->>'id')::uuid where s.name is distinct from btrim(x->>'name')) then perform crm_private.require_permission(p_company,'stages.edit');end if;
 if (select array_agg(s.id order by s.position) from public.crm_stages s where s.company_id=p_company and s.board_id=p_board and s.id=any(new_ids)) is distinct from (select array_agg((x.value->>'id')::uuid order by x.ordinality) from jsonb_array_elements(p_stages) with ordinality x where exists(select 1 from public.crm_stages s where s.company_id=p_company and s.board_id=p_board and s.id=(x.value->>'id')::uuid)) then perform crm_private.require_permission(p_company,'stages.reorder');end if;
 update public.crm_stages set position=position+1000 where company_id=p_company and board_id=p_board;
 for item in select value,ordinality from jsonb_array_elements(p_stages) with ordinality loop
  insert into public.crm_stages(id,company_id,board_id,name,position) values((item.value->>'id')::uuid,p_company,p_board,btrim(item.value->>'name'),item.ordinality-1)
  on conflict(id) do update set name=excluded.name,position=excluded.position;
 end loop;
 for removed in select * from jsonb_to_recordset(coalesce(old_stages,'[]')) as x(id uuid,position integer) where not(id=any(new_ids)) order by position loop
  select x.id into target from jsonb_to_recordset(old_stages) as x(id uuid,position integer) where x.id=any(new_ids) and x.position<removed.position order by x.position desc limit 1;
  if target is null then select x.id into target from jsonb_to_recordset(old_stages) as x(id uuid,position integer) where x.id=any(new_ids) order by x.position limit 1;end if;
  target:=coalesce(target,new_ids[1]);
  update public.crm_opportunities set stage_id=target where company_id=p_company and board_id=p_board and stage_id=removed.id;
  delete from public.crm_stages where company_id=p_company and id=removed.id;
 end loop;
 update public.crm_boards set name=btrim(p_name),row_version=row_version+1 where id=p_board returning * into board;
 return to_jsonb(board)||jsonb_build_object('stages',(select jsonb_agg(to_jsonb(x) order by x.position) from public.crm_stages x where company_id=p_company and board_id=p_board));
end;
$$;

create or replace function crm_private.core_save_card(p_company uuid,p_card uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.crm_opportunities;result public.crm_opportunities;contact uuid;board uuid;stage uuid;strategy uuid;labels uuid[];items uuid[];label uuid;item uuid;
begin
 perform crm_private.require_permission(p_company,case when p_card is null then 'cards.create' else 'cards.edit' end);
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['contact_id','board_id','stage_id','title','value_cents','source','strategy_id','label_ids','catalog_ids','follow_up_at','is_closed'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 if p_card is not null then
  select * into previous from public.crm_opportunities where company_id=p_company and id=p_card for update;
  if not found or previous.archived_at is not null or not crm_private.permission_contact_scope(p_company,previous.contact_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or previous.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 contact:=coalesce((p_values->>'contact_id')::uuid,previous.contact_id);
 if not crm_private.permission_contact_scope(p_company,contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 board:=coalesce((p_values->>'board_id')::uuid,previous.board_id);stage:=coalesce((p_values->>'stage_id')::uuid,previous.stage_id);
 if not exists(select 1 from public.crm_stages where company_id=p_company and board_id=board and id=stage) then raise exception 'CRM_INVALID_STAGE' using errcode='22023';end if;
 if p_values ? 'strategy_id' then strategy:=(p_values->>'strategy_id')::uuid;else strategy:=previous.strategy_id;end if;
 if strategy is not null and not exists(select 1 from public.crm_strategies where company_id=p_company and id=strategy and (active or id=previous.strategy_id)) then raise exception 'CRM_INVALID_STRATEGY' using errcode='22023';end if;
 if p_values ? 'label_ids' then
  if jsonb_typeof(p_values->'label_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  select coalesce(array_agg(distinct x::uuid),'{}') into labels from jsonb_array_elements_text(p_values->'label_ids') x;
 else select coalesce(array_agg(label_id),'{}') into labels from public.crm_card_labels where company_id=p_company and opportunity_id=p_card;end if;
 if cardinality(labels)>3 then raise exception 'CRM_LABEL_LIMIT' using errcode='23514';end if;
 if p_values ? 'catalog_ids' then
  if jsonb_typeof(p_values->'catalog_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  select coalesce(array_agg(distinct x::uuid),'{}') into items from jsonb_array_elements_text(p_values->'catalog_ids') x;
 else select coalesce(array_agg(catalog_id),'{}') into items from public.crm_card_catalog where company_id=p_company and opportunity_id=p_card;end if;
 foreach label in array labels loop
  if not exists(select 1 from public.crm_labels l where l.company_id=p_company and l.id=label and (l.active or exists(select 1 from public.crm_card_labels where company_id=p_company and opportunity_id=p_card and label_id=label))) then raise exception 'CRM_INVALID_LABEL' using errcode='22023';end if;
 end loop;
 foreach item in array items loop
  if not exists(select 1 from public.crm_catalog_items c where c.company_id=p_company and c.id=item and (c.active or exists(select 1 from public.crm_card_catalog where company_id=p_company and opportunity_id=p_card and catalog_id=item))) then raise exception 'CRM_INVALID_CATALOG_ITEM' using errcode='22023';end if;
 end loop;
 if p_card is null then
  insert into public.crm_opportunities(company_id,contact_id,board_id,stage_id,title,value_cents,source,strategy_id,follow_up_at,is_closed)
  values(p_company,contact,board,stage,coalesce(p_values->>'title',''),coalesce((p_values->>'value_cents')::integer,0),coalesce(p_values->>'source',''),strategy,(p_values->>'follow_up_at')::timestamptz,coalesce((p_values->>'is_closed')::boolean,false)) returning * into result;
 else
  update public.crm_opportunities set contact_id=contact,board_id=board,stage_id=stage,title=coalesce(p_values->>'title',previous.title),value_cents=coalesce((p_values->>'value_cents')::integer,previous.value_cents),source=coalesce(p_values->>'source',previous.source),strategy_id=strategy,
  follow_up_at=case when p_values ? 'follow_up_at' then (p_values->>'follow_up_at')::timestamptz else previous.follow_up_at end,
  is_closed=coalesce((p_values->>'is_closed')::boolean,previous.is_closed) where id=p_card returning * into result;
 end if;
 delete from public.crm_card_labels where company_id=p_company and opportunity_id=result.id and not(label_id=any(labels));
 insert into public.crm_card_labels(company_id,opportunity_id,label_id) select p_company,result.id,x from unnest(labels) x where not exists(select 1 from public.crm_card_labels where company_id=p_company and opportunity_id=result.id and label_id=x);
 delete from public.crm_card_catalog where company_id=p_company and opportunity_id=result.id and not(catalog_id=any(items));
 insert into public.crm_card_catalog(company_id,opportunity_id,catalog_id) select p_company,result.id,x from unnest(items) x where not exists(select 1 from public.crm_card_catalog where company_id=p_company and opportunity_id=result.id and catalog_id=x);
 if p_card is not null and (p_values ? 'label_ids' or p_values ? 'catalog_ids') then
  insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body)
  values(p_company,contact,result.id,(select auth.uid()),coalesce((select display_name from public.crm_profiles where id=(select auth.uid())),'Usuário'),'card_updated','Interesses e etiquetas atualizados','Seleções de etiquetas e serviços/produtos conferidas no card.');
 end if;
 return to_jsonb(result)||jsonb_build_object('label_ids',to_jsonb(labels),'catalog_ids',to_jsonb(items));
end;
$$;

create or replace function crm_private.workspace_save_contact(p_company uuid,p_contact uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.crm_contacts;result public.crm_contacts;owner uuid;role text;items uuid[];item uuid;normalized_phone text;
begin
 role:=crm_private.company_role(p_company);
 if not crm_private.has_permission(p_company,case when p_contact is null then 'contacts.create' else 'contacts.edit' end) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['name','phone','email','temperature','interests','notes','owner_membership_id','catalog_ids'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for key share;
 if p_contact is not null then
  select * into old_row from public.crm_contacts where company_id=p_company and id=p_contact for update;
  if not found or not crm_private.can_write_contact(p_company,p_contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or old_row.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 owner:=coalesce((p_values->>'owner_membership_id')::uuid,old_row.owner_membership_id,(select id from public.crm_memberships where company_id=p_company and user_id=(select auth.uid()) and active));
 if not crm_private.has_company_scope(p_company) and not crm_private.owns_membership(p_company,owner) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
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

create or replace function crm_private.workspace_save_task(p_company uuid,p_task uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.crm_tasks;result public.crm_tasks;role text;owner uuid;contact uuid;card uuid;
begin
 perform crm_private.require_permission(p_company,case when p_task is null then 'tasks.create' else 'tasks.edit' end);
 role:=crm_private.company_role(p_company);
 if not crm_private.has_company_access(p_company) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['owner_membership_id','contact_id','opportunity_id','title','due_date','status'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for key share;
 if p_task is not null then
  select * into old_row from public.crm_tasks where company_id=p_company and id=p_task for update;
  if not found or not(crm_private.has_company_scope(p_company) or crm_private.owns_membership(p_company,old_row.owner_membership_id)) or (old_row.contact_id is not null and not crm_private.can_read_contact(p_company,old_row.contact_id)) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or old_row.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 owner:=coalesce((p_values->>'owner_membership_id')::uuid,old_row.owner_membership_id,(select id from public.crm_memberships where company_id=p_company and user_id=(select auth.uid()) and active));
 if not crm_private.has_company_scope(p_company) and not crm_private.owns_membership(p_company,owner) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
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

create or replace function crm_private.workspace_team_members(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform crm_private.require_permission(p_company,'team.view');
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'active',m.active,'row_version',m.row_version,'display_name',p.display_name,'email',u.email) order by p.display_name),'[]') into result
 from public.crm_memberships m join public.crm_profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where m.company_id=p_company;
 return result;
end;
$$;

create or replace function crm_private.workspace_update_team_member(p_company uuid,p_membership uuid,p_values jsonb,p_reassign_to uuid,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.crm_memberships;target public.crm_memberships;next_active boolean;next_role text;next_name text;
begin
 perform crm_private.require_permission(p_company,'team.manage');
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['display_name','role','active'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for update;
 select * into member from public.crm_memberships where company_id=p_company and id=p_membership for update;
 if not found or member.role='manager' or member.user_id=(select auth.uid()) or exists(select 1 from crm_private.platform_admins where user_id=member.user_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if crm_private.company_role(p_company)<>'manager' and (
  not exists(select 1 from crm_private.employee_access a where a.membership_id=member.id)
  or exists(select 1 from crm_private.employee_access a,unnest(a.keys) k where a.membership_id=member.id and not crm_private.has_permission(p_company,k))
  or (crm_private.member_company_scope(member.id) and not crm_private.has_company_scope(p_company))
  or (p_values ? 'role' and p_values->>'role' is distinct from member.role)
 ) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
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
   select * into target from public.crm_memberships where company_id=p_company and id=p_reassign_to and active and id<>member.id and crm_private.member_permission(id,'contacts.view') for key share;
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

create or replace function crm_private.workspace_update_company_brand(p_company uuid,p_values jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_companies;logo text;
begin
 perform crm_private.require_permission(p_company,'settings.edit');
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

create or replace function crm_private.amb_close_campaign(p_company uuid,p_campaign uuid,p_expected_version bigint,p_request_id uuid,p_confirm_pending boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;
begin
 perform crm_private.require_permission(p_company,'campaigns.close');
 if p_request_id is null then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 select * into c from public.crm_ambassador_campaigns where company_id=p_company and id=p_campaign for update;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if c.status='closed' then
  if c.closed_request_id=p_request_id and c.closed_by=(select auth.uid()) then return to_jsonb(c);end if;
  raise exception 'CRM_CAMPAIGN_CLOSED' using errcode='23514';
 end if;
 if p_expected_version is null or c.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if not coalesce(p_confirm_pending,false) and exists(select 1 from public.crm_ambassador_referrals where company_id=p_company and campaign_id=p_campaign and not cancelled and (not paid or not attended)) then raise exception 'CRM_PENDING_REFERRALS' using errcode='23514';end if;
 insert into public.crm_campaign_participants(company_id,campaign_id,ambassador_id,ambassador_name,category,commission_enabled)
 select p_company,p_campaign,a.id,person.name,a.category,a.commission_enabled from public.crm_ambassadors a join public.crm_contacts person on person.company_id=a.company_id and person.id=a.contact_id where a.company_id=p_company;
 update public.crm_ambassador_campaigns set status='closed',closed_at=statement_timestamp(),closed_by=(select auth.uid()),closed_request_id=p_request_id where id=p_campaign returning * into c;
 return to_jsonb(c);
end;
$$;

create or replace function crm_private.amb_record_campaign_payment(p_company uuid,p_campaign uuid,p_ambassador uuid,p_expected_amount_cents bigint,p_request_id uuid,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;totals record;previous public.crm_campaign_payments;result public.crm_campaign_payments;hash text;
begin
 perform crm_private.require_permission(p_company,'campaigns.pay');
 if p_request_id is null or p_expected_amount_cents is null or p_expected_amount_cents<=0 or p_note is null or length(p_note)>500 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 hash:=encode(sha256(convert_to(jsonb_build_array(p_company,p_campaign,p_ambassador,p_expected_amount_cents,btrim(p_note))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,95));
 select * into previous from public.crm_campaign_payments where request_id=p_request_id;
 if found then
  if previous.actor_user_id<>(select auth.uid()) or previous.company_id<>p_company or previous.fingerprint<>hash then raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';end if;return to_jsonb(previous);
 end if;
 select * into c from public.crm_ambassador_campaigns where company_id=p_company and id=p_campaign for update;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if c.status<>'closed' then raise exception 'CRM_CLOSE_CAMPAIGN_FIRST' using errcode='23514';end if;
 select * into totals from public.crm_ambassador_campaign_totals where company_id=p_company and campaign_id=p_campaign and ambassador_id=p_ambassador;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if totals.settled then raise exception 'CRM_ALREADY_SETTLED' using errcode='23505';end if;
 if totals.amount_cents<>p_expected_amount_cents then raise exception 'CRM_TOTALS_CHANGED' using errcode='40001';end if;
 if totals.amount_cents<=0 or totals.amount_cents>9007199254740991 then raise exception 'CRM_INVALID_AMOUNT' using errcode='22023';end if;
 insert into public.crm_campaign_payments(request_id,company_id,campaign_id,ambassador_id,ambassador_name,actor_user_id,eligible_cents,points,amount_cents,note,fingerprint)
 values(p_request_id,p_company,p_campaign,p_ambassador,totals.ambassador_name,(select auth.uid()),totals.eligible_cents,totals.points,totals.amount_cents,btrim(p_note),hash) returning * into result;
 return to_jsonb(result);
end;
$$;

create or replace function crm_private.amb_adjust_referral(p_company uuid,p_referral uuid,p_expected_version bigint,p_refunded_cents integer,p_cancelled boolean,p_reason text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.crm_ambassador_referrals;camp uuid;previous public.crm_referral_revisions;hash text;
begin
 perform crm_private.require_permission(p_company,'referrals.adjust');
 if p_request_id is null or p_refunded_cents is null or p_refunded_cents<0 or p_cancelled is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 hash:=encode(sha256(convert_to(jsonb_build_array(p_company,p_referral,p_expected_version,p_refunded_cents,p_cancelled,btrim(p_reason))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,94));
 select * into previous from public.crm_referral_revisions where request_id=p_request_id;
 if found then if previous.actor_user_id<>(select auth.uid()) or previous.company_id<>p_company or previous.fingerprint<>hash then raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';end if;return previous.result;end if;
 select campaign_id into camp from public.crm_ambassador_referrals where company_id=p_company and id=p_referral;
 if camp is null then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 perform 1 from public.crm_ambassador_campaigns where company_id=p_company and id=camp for update;
 select * into r from public.crm_ambassador_referrals where company_id=p_company and id=p_referral for update;
 if p_expected_version is null or r.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if p_refunded_cents>r.value_cents then raise exception 'CRM_INVALID_AMOUNT' using errcode='22023';end if;
 update public.crm_ambassador_referrals set refunded_cents=p_refunded_cents,cancelled=p_cancelled where id=p_referral returning * into r;
 insert into public.crm_referral_revisions(request_id,company_id,referral_id,actor_user_id,kind,fingerprint,reason,result)
 values(p_request_id,p_company,p_referral,(select auth.uid()),'adjusted',hash,btrim(p_reason),to_jsonb(r));
 return to_jsonb(r);
end;
$$;

create or replace function crm_private.amb_save_referral(p_company uuid,p_referral uuid,p_campaign uuid,p_ambassador uuid,p_opportunity uuid,p_values jsonb,p_request_id uuid,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;r public.crm_ambassador_referrals;o public.crm_opportunities;previous public.crm_referral_revisions;hash text;items uuid[];item uuid;
begin
 perform crm_private.require_permission(p_company,case when p_referral is null then 'referrals.create' else 'referrals.edit' end);
 if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['value_cents','sold_on','paid','attended','catalog_ids'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 hash:=encode(sha256(convert_to(jsonb_build_array(p_company,p_referral,p_campaign,p_ambassador,p_opportunity,p_values,p_expected_version)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,94));
 select * into previous from public.crm_referral_revisions where request_id=p_request_id;
 if found then
  if previous.actor_user_id<>(select auth.uid()) or previous.company_id<>p_company or previous.fingerprint<>hash then raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';end if;return previous.result;
 end if;
 select * into c from public.crm_ambassador_campaigns where company_id=p_company and id=p_campaign for update;
 if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002';end if;
 if c.status<>'active' then raise exception 'CRM_CAMPAIGN_CLOSED' using errcode='23514';end if;
 if not exists(select 1 from public.crm_ambassadors where company_id=p_company and id=p_ambassador and crm_private.permission_contact_scope(p_company,contact_id) and (active or p_referral is not null)) then raise exception 'CRM_INVALID_AMBASSADOR' using errcode='22023';end if;
 select * into o from public.crm_opportunities where company_id=p_company and id=p_opportunity;
 if not found or o.archived_at is not null or not crm_private.permission_contact_scope(p_company,o.contact_id) then raise exception 'CRM_INVALID_CARD' using errcode='22023';end if;
 if p_referral is not null then
  select * into r from public.crm_ambassador_referrals where company_id=p_company and id=p_referral for update;
  if not found or r.campaign_id<>p_campaign or r.ambassador_id<>p_ambassador or r.opportunity_id<>p_opportunity then raise exception 'CRM_INVALID_REFERRAL' using errcode='22023';end if;
  if p_expected_version is null or r.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 if (p_values->>'sold_on')::date is null or (p_values->>'sold_on')::date<c.starts_on or (p_values->>'sold_on')::date>c.ends_on
 or (p_values->>'sold_on')::date>(statement_timestamp() at time zone 'America/Sao_Paulo')::date or (p_values->>'value_cents')::integer is null or (p_values->>'value_cents')::integer<=0 then raise exception 'CRM_INVALID_SALE' using errcode='22023';end if;
 if coalesce((p_values->>'value_cents')::integer,0)<coalesce(r.refunded_cents,0) then raise exception 'CRM_INVALID_SALE' using errcode='22023';end if;
 if p_values ? 'catalog_ids' and jsonb_typeof(p_values->'catalog_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 select coalesce(array_agg(distinct x::uuid),'{}') into items from jsonb_array_elements_text(coalesce(p_values->'catalog_ids','[]')) x;
 foreach item in array items loop
  if not exists(select 1 from public.crm_catalog_items ci where ci.company_id=p_company and ci.id=item and (ci.active or exists(select 1 from public.crm_referral_catalog where company_id=p_company and referral_id=p_referral and catalog_id=item))) then raise exception 'CRM_INVALID_CATALOG_ITEM' using errcode='22023';end if;
 end loop;
 if p_referral is null then
  insert into public.crm_ambassador_referrals(company_id,campaign_id,ambassador_id,opportunity_id,contact_id,value_cents,sold_on,paid,attended)
  values(p_company,p_campaign,p_ambassador,p_opportunity,o.contact_id,(p_values->>'value_cents')::integer,(p_values->>'sold_on')::date,coalesce((p_values->>'paid')::boolean,false),coalesce((p_values->>'attended')::boolean,false)) returning * into r;
 else
  update public.crm_ambassador_referrals set value_cents=(p_values->>'value_cents')::integer,sold_on=(p_values->>'sold_on')::date,
  paid=coalesce((p_values->>'paid')::boolean,false),attended=coalesce((p_values->>'attended')::boolean,false) where id=p_referral returning * into r;
 end if;
 delete from public.crm_referral_catalog where company_id=p_company and referral_id=r.id and not(catalog_id=any(items));
 insert into public.crm_referral_catalog(company_id,referral_id,catalog_id) select p_company,r.id,x from unnest(items) x where not exists(select 1 from public.crm_referral_catalog where company_id=p_company and referral_id=r.id and catalog_id=x);
 insert into public.crm_referral_revisions(request_id,company_id,referral_id,actor_user_id,kind,fingerprint,result)
 values(p_request_id,p_company,r.id,(select auth.uid()),case when p_referral is null then 'created' else 'updated' end,hash,to_jsonb(r));
 return to_jsonb(r);
end;
$$;

create or replace function public.crm_workspace_metrics(p_company uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 perform crm_private.require_permission(p_company,'dashboard.view');
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

create or replace function public.crm_import_contacts(p_company_id uuid, p_owner_membership_id uuid, p_contacts jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare inserted integer;
begin
  if not crm_private.has_permission(p_company_id,'contacts.import') or auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    raise exception using errcode='22023', message='Expected contacts array';
  end if;
  if jsonb_array_length(p_contacts) not between 1 and 1000 then
    raise exception using errcode='22023', message='Import between 1 and 1000 contacts';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_contacts) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(jsonb_typeof(item->'name'),'null') <> 'string'
      or coalesce(jsonb_typeof(item->'phone'),'null') <> 'string'
      or length(btrim(item->>'name')) not between 1 and 100
      or (item->>'phone') !~ '^[0-9]{2}([2-5][0-9]{7}|9[0-9]{8})$'
      or left(item->>'phone',2) not in ('11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99')
  ) then
    raise exception using errcode='22023', message='Invalid name or Brazilian phone with DDD';
  end if;
  with added as (
    insert into public.crm_contacts(company_id, owner_membership_id, name, phone)
    select p_company_id, p_owner_membership_id, btrim(item->>'name'), item->>'phone'
    from jsonb_array_elements(p_contacts) with ordinality as rows(item, position)
    order by position
    on conflict do nothing
    returning id
  ) select count(*)::integer into inserted from added;
  return inserted;
end;
$$;

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
    or not crm_private.has_permission(p_company,'team.manage')
    or not crm_private.subscription_allows_access(p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

revoke all on function crm_private.member_permission(uuid,text) from public,anon,authenticated,service_role;
revoke all on function crm_private.member_company_scope(uuid) from public,anon,authenticated,service_role;
revoke all on function crm_private.has_permission(uuid,text) from public,anon,authenticated,service_role;grant execute on function crm_private.has_permission(uuid,text) to authenticated;
revoke all on function crm_private.has_company_scope(uuid) from public,anon,authenticated,service_role;grant execute on function crm_private.has_company_scope(uuid) to authenticated;
revoke all on function crm_private.permission_contact_scope(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function crm_private.permission_contact_scope(uuid,uuid) to authenticated;
revoke all on function crm_private.require_permission(uuid,text) from public,anon,authenticated,service_role;grant execute on function crm_private.require_permission(uuid,text) to authenticated;
revoke all on function public.crm_employee_permissions(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.crm_employee_permissions(uuid,uuid) to authenticated;
revoke all on function public.crm_set_employee_permissions(uuid,uuid,text[],text,bigint) from public,anon,authenticated,service_role;grant execute on function public.crm_set_employee_permissions(uuid,uuid,text[],text,bigint) to authenticated;

create or replace function public.crm_edge_finish_user(
  p_actor uuid, p_request_id uuid, p_user uuid, p_display_name text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare item crm_private.user_provisioning; member uuid;
begin
  select * into item from crm_private.user_provisioning where request_id = p_request_id for update;
  if not found or item.actor_user_id is distinct from p_actor then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  perform crm_private.edge_authorize_user_creation(p_actor, item.company_id, item.role);
  if item.state = 'complete' and item.user_id = p_user then
    return jsonb_build_object('state', 'complete', 'user_id', item.user_id, 'membership_id', item.membership_id);
  end if;
  if item.state <> 'pending' then
    raise exception 'CRM_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if not exists (select 1 from auth.users where id = p_user
      and raw_app_meta_data->>'crm_provisioning_id' = p_request_id::text)
    or exists (select 1 from public.crm_profiles where id = p_user)
    or exists (select 1 from crm_private.platform_admins where user_id = p_user) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.crm_profiles(id, display_name) values (p_user, p_display_name);
  insert into public.crm_memberships(company_id, user_id, role)
    values (item.company_id, p_user, item.role) returning id into member;
  if item.role<>'manager' then insert into crm_private.employee_access(membership_id,keys,scope,updated_by) values(member,'{}','own',p_actor);end if;
  update crm_private.user_provisioning set state = 'complete', user_id = p_user,
    membership_id = member, finished_at = statement_timestamp() where request_id = p_request_id;
  return jsonb_build_object('state', 'complete', 'user_id', p_user, 'membership_id', member);
end;
$$;

create or replace view public.crm_contact_activity_report with (security_invoker=true) as
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
 where crm_private.has_permission(c.company_id,'reports.view') and crm_private.has_company_access(c.company_id)
 group by c.company_id,c.id,c.name,c.phone,c.owner_membership_id,p.display_name,c.created_at;

create or replace view public.crm_team_activity_report with (security_invoker=true) as
 select h.company_id,h.actor_user_id as actor_id,(array_agg(h.actor_name order by h.occurred_at desc))[1] as actor_name,
 count(*)::integer as total,
 count(*) filter(where h.kind='whatsapp_opened')::integer as whatsapp_count,
 count(*) filter(where h.kind='card_moved')::integer as movement_count,
 count(*) filter(where h.kind='note')::integer as note_count,
 count(distinct h.contact_id)::integer as contacts_count,
 max(h.occurred_at) as last_activity_at
 from public.crm_contact_history h
 where h.occurred_at>=now()-interval '30 days' and h.actor_user_id is not null
 and crm_private.has_permission(h.company_id,'reports.view') and crm_private.has_company_access(h.company_id)
 group by h.company_id,h.actor_user_id;

create or replace view public.crm_card_idle_report with(security_invoker=true) as select * from public.crm_card_activity
 where crm_private.has_permission(company_id,'reports.view') and not is_closed;

create or replace function crm_private.subscription_summary(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare bill public.crm_company_billing; local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  state text; events jsonb;
begin
  if not crm_private.has_current_acceptance() or
    not (crm_private.is_platform_admin() or crm_private.has_permission(p_company,'plan.view')) then
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

create or replace function crm_private.can_access_company_logo(p_name text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare company uuid;prefix text:=split_part(p_name,'/',1);
begin
 if prefix !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' or p_name ~ '(^|/)\.\.(/|$)' then return false;end if;
 company:=prefix::uuid;
 return crm_private.has_company_access(company) and (not p_write or crm_private.has_permission(company,'settings.edit'));
end;$$;

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
  elsif not crm_private.has_permission(p_company,'team.manage')
    or not crm_private.subscription_allows_access(p_company)
    or target_role is null or target_role not in ('seller', 'reception') then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if not crm_private.is_platform_admin() and crm_private.company_role(p_company)<>'manager' and exists(
   select 1 from public.crm_memberships m where m.company_id=p_company and m.user_id=p_target and (
   exists(select 1 from crm_private.permission_catalog c where crm_private.member_permission(m.id,c.key) and not crm_private.has_permission(p_company,c.key))
   or (crm_private.member_company_scope(m.id) and not crm_private.has_company_scope(p_company)))) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
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


create policy permissions_not_archived on public.crm_opportunities as restrictive for all to authenticated using(archived_at is null) with check(archived_at is null);
create function public.crm_delete_card(p_company uuid,p_card uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare card public.crm_opportunities;
begin
 perform crm_private.require_permission(p_company,'cards.delete');
 select * into card from public.crm_opportunities where company_id=p_company and id=p_card and archived_at is null for update;
 if not found or not crm_private.permission_contact_scope(p_company,card.contact_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_expected_version is null or p_expected_version<>card.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if exists(select 1 from public.crm_ambassador_referrals where company_id=p_company and opportunity_id=p_card) then raise exception 'CRM_CARD_HAS_REFERRALS' using errcode='23514';end if;
 update public.crm_opportunities set archived_at=statement_timestamp(),is_closed=true where id=p_card;
 insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body) values(p_company,card.contact_id,card.id,(select auth.uid()),coalesce((select display_name from public.crm_profiles where id=(select auth.uid())),'Usuário'),'card_updated','Card excluído','O card foi removido do funil. Seu histórico permanece preservado.');
end;$$;
revoke all on function public.crm_delete_card(uuid,uuid,bigint) from public,anon,service_role;grant execute on function public.crm_delete_card(uuid,uuid,bigint) to authenticated;

create or replace function crm_private.notification_candidates(p_recipient uuid)
returns table(company_id uuid,recipient_user_id uuid,kind text,entity_id uuid,event_key text,
  title text,body text,priority smallint,contact_id uuid)
language sql stable security invoker set search_path='' as $$
  with memberships as materialized (
    select m.id,m.company_id,m.role,m.user_id,
      (statement_timestamp() at time zone 'America/Sao_Paulo')::date as local_today
    from public.crm_memberships m
    join public.crm_companies c on c.id=m.company_id
    where (p_recipient is null or m.user_id=p_recipient) and m.active and c.enabled
      and exists(select 1 from public.crm_profiles p where p.id=m.user_id and not p.password_change_required)
      and (select count(*) from public.crm_legal_requirements)=2
      and not exists(
        select 1 from public.crm_legal_requirements r where not exists(
          select 1 from public.crm_legal_acceptances a
          where a.user_id=m.user_id and a.kind=r.kind and a.version=r.version
        )
      )
  ), card_activity as materialized (
    select v.* from public.crm_card_activity v
    where not v.is_closed and exists(select 1 from memberships m where m.company_id=v.company_id)
  ), candidates as (
    select m.company_id,m.user_id as recipient_user_id,'subscription_due'::text as kind,m.company_id as entity_id,
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
    where crm_private.member_permission(m.id,'plan.view') and b.due_date<=local_today+7

    union all
    select m.company_id,m.user_id,'task_assigned',t.id,t.id::text || ':' || m.id::text,
      'Tarefa atribuída a você','Há uma tarefa pendente sob sua responsabilidade. Confira os detalhes e o prazo.'
    from memberships m join public.crm_tasks t on t.company_id=m.company_id and t.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'tasks.view') and t.status<>'done' and t.due_date>local_today

    union all
    select m.company_id,m.user_id,'task_due',t.id,t.id::text || ':' || t.due_date::text || ':' || case when t.due_date<local_today then 'overdue' else 'today' end,
      case when t.due_date<local_today then 'Tarefa com prazo vencido' else 'Tarefa com prazo para hoje' end,
      case when (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) then 'Há uma tarefa da equipe que precisa de acompanhamento.' else 'Confira a tarefa sob sua responsabilidade e atualize o andamento.' end
    from memberships m join public.crm_tasks t on t.company_id=m.company_id
    where crm_private.member_permission(m.id,'tasks.view') and t.status<>'done' and t.due_date<=local_today and ((crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) or t.owner_membership_id=m.id)

    union all
    select m.company_id,m.user_id,'new_contact',c.id,c.id::text,
      'Novo contato na empresa','Um novo contato entrou na carteira da empresa. Confira o responsável pelo atendimento.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id
    where crm_private.member_permission(m.id,'contacts.view') and (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) and c.created_at>=statement_timestamp()-interval '7 days'

    union all
    select m.company_id,m.user_id,'contact_assigned',c.id,c.id::text || ':' || m.id::text,
      'Contato atribuído a você','Há um contato atribuído ao seu usuário. Confira o atendimento e o próximo passo.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id and c.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'contacts.view') and m.role in ('seller','reception') and c.updated_at>=statement_timestamp()-interval '7 days'
    union all
    select m.company_id,m.user_id,'card_first_response',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':first',
      'Card aguardando primeiro acompanhamento','Uma oportunidade aguarda acompanhamento há mais de '||v.first_response_hours::text||' horas. Abra o contato e confira o próximo passo.'
    from memberships m join card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and v.alerts_enabled and not v.is_closed and v.first_activity_at is null and v.hours_without_activity>=v.first_response_hours and v.days_without_activity<v.idle_days_threshold
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,m.user_id,'card_idle',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':idle',
      'Card sem acompanhamento','Uma oportunidade está sem acompanhamento há '||v.idle_days_threshold::text||' dias ou mais. Confira o retorno combinado e registre o atendimento.'
    from memberships m join card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.idle_days_threshold
      and (not (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) or v.days_without_activity<v.escalation_days_threshold)
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,m.user_id,'card_escalation',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':escalation',
      'Card precisa de acompanhamento da gestão','Uma oportunidade da equipe está sem acompanhamento há '||v.escalation_days_threshold::text||' dias ou mais. Confira o responsável e as atividades registradas.'
    from memberships m join card_activity v on v.company_id=m.company_id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) and v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.escalation_days_threshold
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())

  )
  select c.company_id,c.recipient_user_id,c.kind,c.entity_id,c.event_key,c.title,c.body,
    (case when c.kind='subscription_due' then 3 when c.kind in ('task_due','card_escalation') then 2 else 1 end)::smallint,
    case when c.kind in ('card_first_response','card_idle','card_escalation') then
      (select o.contact_id from public.crm_opportunities o where o.company_id=c.company_id and o.id=c.entity_id)
    else null end
  from candidates c
  where (c.kind='subscription_due' or crm_private.subscription_allows_access(c.company_id))
 and exists(select 1 from memberships m where m.company_id=c.company_id and m.user_id=c.recipient_user_id and
 case when c.kind in ('task_assigned','task_due') then crm_private.member_permission(m.id,'tasks.view')
 when c.kind in ('new_contact','contact_assigned') then crm_private.member_permission(m.id,'contacts.view')
 when c.kind in ('card_first_response','card_idle','card_escalation') then crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view')
 else crm_private.member_permission(m.id,'plan.view') end);
$$;

create or replace function crm_private.can_read_notification(p_company uuid,p_recipient uuid,p_kind text,p_entity uuid,p_contact uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare role text;
begin
 if p_recipient is distinct from (select auth.uid()) or not crm_private.has_current_acceptance() then return false;end if;
 role:=crm_private.company_role(p_company);
 if p_kind='subscription_due' then return crm_private.has_permission(p_company,'plan.view');end if;
 if not crm_private.has_company_access(p_company) then return false;end if;
 if p_kind='new_contact' then return crm_private.has_permission(p_company,'reports.view') and crm_private.can_read_contact(p_company,p_entity);end if;
 if p_kind in ('task_assigned','task_due') then return crm_private.has_permission(p_company,'tasks.view') and exists(select 1 from public.crm_tasks t where t.company_id=p_company and t.id=p_entity and t.status<>'done' and (crm_private.owns_membership(t.company_id,t.owner_membership_id) or (p_kind='task_due' and crm_private.has_permission(p_company,'reports.view') and crm_private.has_company_scope(p_company))) and (t.contact_id is null or crm_private.can_read_contact(t.company_id,t.contact_id)));end if;
 if p_kind='contact_assigned' then return crm_private.has_permission(p_company,'contacts.view') and exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_entity and crm_private.owns_membership(c.company_id,c.owner_membership_id));end if;
 if p_kind in ('card_first_response','card_idle','card_escalation') then return crm_private.has_permission(p_company,'cards.view') and exists(
  select 1 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
  where o.company_id=p_company and o.id=p_entity and o.contact_id=p_contact and not o.is_closed
  and crm_private.can_read_contact(p_company,p_contact)
  and ((p_kind='card_escalation' and crm_private.has_permission(p_company,'reports.view')) or (p_kind<>'card_escalation' and crm_private.owns_membership(c.company_id,c.owner_membership_id))));end if;
 return false;
end;$$;
drop policy if exists notifications_read on public.crm_notifications;
do $pol$ declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='crm_notifications' loop execute format('drop policy %I on public.crm_notifications',p.policyname);end loop;end;$pol$;
create policy permissions_select on public.crm_notifications for select to authenticated using(recipient_user_id=(select auth.uid()) and active and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id));
create policy permissions_update on public.crm_notifications for update to authenticated using(recipient_user_id=(select auth.uid()) and active and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id)) with check(recipient_user_id=(select auth.uid()) and crm_private.can_read_notification(company_id,recipient_user_id,kind,entity_id,contact_id));

create or replace function crm_private.core_validate_task() returns trigger language plpgsql security definer set search_path='' as $$
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
  if not crm_private.member_company_scope(new.owner_membership_id) and c.owner_membership_id<>new.owner_membership_id then raise exception 'CRM_TASK_OWNER_MISMATCH' using errcode='23514';end if;
 end if;return new;
end;$$;
commit;
