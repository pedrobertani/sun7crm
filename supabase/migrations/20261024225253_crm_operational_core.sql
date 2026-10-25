-- Operações da empresa. A demo continua isolada; nenhuma pessoa ou venda fictícia é criada.
begin;
alter table public.crm_boards drop constraint crm_boards_kind_check;
alter table public.crm_boards add check(kind in ('leads','clients','custom'));
alter table public.crm_boards add column row_version bigint not null default 1;
alter table public.crm_contacts add column row_version bigint not null default 1;
alter table public.crm_opportunities
 add column title text not null default '' check(length(title)<=160),
 add column strategy_id uuid,
 add column follow_up_at timestamptz,
 add column is_closed boolean not null default false,
 add column row_version bigint not null default 1;

create table public.crm_catalog_items(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.crm_companies(id),
 kind text not null check(kind in ('service','product')),name text not null check(length(btrim(name)) between 1 and 160),
 description text not null default '' check(length(description)<=4000),value_cents integer not null default 0 check(value_cents>=0),
 active boolean not null default true,created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id));
create index crm_catalog_company_active_idx on public.crm_catalog_items(company_id,active,name);
create table public.crm_labels(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.crm_companies(id),
 name text not null check(length(btrim(name)) between 1 and 50),color text not null check(color ~ '^#[a-fA-F0-9]{6}$'),active boolean not null default true,
 created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id));
create unique index crm_labels_company_name_idx on public.crm_labels(company_id,lower(btrim(name))) where active;
create table public.crm_strategies(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.crm_companies(id),
 name text not null check(length(btrim(name)) between 1 and 160),month date not null check(extract(day from month)=1),
 channel text not null default '' check(length(channel)<=80),status text not null default 'planned' check(status in ('planned','active','completed')),
 budget_cents integer not null default 0 check(budget_cents>=0),owner_membership_id uuid not null,notes text not null default '' check(length(notes)<=10000),
 active boolean not null default true,created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,owner_membership_id) references public.crm_memberships(company_id,id));
create index crm_strategies_company_month_idx on public.crm_strategies(company_id,month,status);
create index crm_strategies_owner_idx on public.crm_strategies(company_id,owner_membership_id);
alter table public.crm_opportunities add foreign key(company_id,strategy_id) references public.crm_strategies(company_id,id);
create index crm_opportunities_strategy_idx on public.crm_opportunities(company_id,strategy_id);

create table public.crm_card_labels(
 company_id uuid not null,opportunity_id uuid not null,label_id uuid not null,primary key(company_id,opportunity_id,label_id),
 foreign key(company_id,opportunity_id) references public.crm_opportunities(company_id,id),foreign key(company_id,label_id) references public.crm_labels(company_id,id));
create index crm_card_labels_label_idx on public.crm_card_labels(company_id,label_id);
create table public.crm_card_catalog(
 company_id uuid not null,opportunity_id uuid not null,catalog_id uuid not null,primary key(company_id,opportunity_id,catalog_id),
 foreign key(company_id,opportunity_id) references public.crm_opportunities(company_id,id),foreign key(company_id,catalog_id) references public.crm_catalog_items(company_id,id));
create index crm_card_catalog_item_idx on public.crm_card_catalog(company_id,catalog_id);
create table public.crm_contact_catalog(
 company_id uuid not null,contact_id uuid not null,catalog_id uuid not null,primary key(company_id,contact_id,catalog_id),
 foreign key(company_id,contact_id) references public.crm_contacts(company_id,id),foreign key(company_id,catalog_id) references public.crm_catalog_items(company_id,id));
create index crm_contact_catalog_item_idx on public.crm_contact_catalog(company_id,catalog_id);

create function crm_private.core_require_manager(p_company uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not crm_private.has_company_access(p_company) or crm_private.company_role(p_company) is distinct from 'manager' then
 raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
end;$$;
revoke all on function crm_private.core_require_manager(uuid) from public,anon,authenticated,service_role;

create function crm_private.core_touch_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.row_version:=old.row_version+1;return new;end;$$;
revoke all on function crm_private.core_touch_version() from public,anon,authenticated,service_role;
create trigger core_contact_version before update on public.crm_contacts for each row execute function crm_private.core_touch_version();
create trigger core_card_version before update on public.crm_opportunities for each row execute function crm_private.core_touch_version();

-- RLS para os cadastros; a estrutura dos funis e os relacionamentos só mudam pelos comandos abaixo.
alter table public.crm_catalog_items enable row level security;
revoke all on public.crm_catalog_items from public,anon,authenticated,service_role;
grant select on public.crm_catalog_items to authenticated;
create policy crm_catalog_items_read on public.crm_catalog_items for select to authenticated using(crm_private.has_company_access(company_id));
create policy crm_catalog_items_insert on public.crm_catalog_items for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_catalog_items_update on public.crm_catalog_items for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create trigger protect_crm_catalog_items before update on public.crm_catalog_items for each row execute function crm_private.protect_identity_and_touch();
create trigger audit_crm_catalog_items after insert or update on public.crm_catalog_items for each row execute function crm_private.audit_change();
alter table public.crm_labels enable row level security;
revoke all on public.crm_labels from public,anon,authenticated,service_role;
grant select on public.crm_labels to authenticated;
create policy crm_labels_read on public.crm_labels for select to authenticated using(crm_private.has_company_access(company_id));
create policy crm_labels_insert on public.crm_labels for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_labels_update on public.crm_labels for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create trigger protect_crm_labels before update on public.crm_labels for each row execute function crm_private.protect_identity_and_touch();
create trigger audit_crm_labels after insert or update on public.crm_labels for each row execute function crm_private.audit_change();
alter table public.crm_strategies enable row level security;
revoke all on public.crm_strategies from public,anon,authenticated,service_role;
grant select on public.crm_strategies to authenticated;
create policy crm_strategies_read on public.crm_strategies for select to authenticated using(crm_private.has_company_access(company_id));
create policy crm_strategies_insert on public.crm_strategies for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager' and crm_private.active_membership(company_id,owner_membership_id));
create policy crm_strategies_update on public.crm_strategies for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager' and crm_private.active_membership(company_id,owner_membership_id));
create trigger protect_crm_strategies before update on public.crm_strategies for each row execute function crm_private.protect_identity_and_touch();
create trigger audit_crm_strategies after insert or update on public.crm_strategies for each row execute function crm_private.audit_change();
grant insert(company_id,kind,name,description,value_cents,active) on public.crm_catalog_items to authenticated;
grant update(kind,name,description,value_cents,active) on public.crm_catalog_items to authenticated;
grant insert(company_id,name,color,active) on public.crm_labels to authenticated;
grant update(name,color,active) on public.crm_labels to authenticated;
grant insert(company_id,name,month,channel,status,budget_cents,owner_membership_id,notes,active) on public.crm_strategies to authenticated;
grant update(name,month,channel,status,budget_cents,owner_membership_id,notes,active) on public.crm_strategies to authenticated;
alter table public.crm_card_labels enable row level security;
revoke all on public.crm_card_labels from public,anon,authenticated,service_role;
grant select on public.crm_card_labels to authenticated;
create policy crm_card_labels_read on public.crm_card_labels for select to authenticated using(exists(select 1 from public.crm_opportunities o where o.company_id=crm_card_labels.company_id and o.id=crm_card_labels.opportunity_id and crm_private.can_read_contact(o.company_id,o.contact_id)));
alter table public.crm_card_catalog enable row level security;
revoke all on public.crm_card_catalog from public,anon,authenticated,service_role;
grant select on public.crm_card_catalog to authenticated;
create policy crm_card_catalog_read on public.crm_card_catalog for select to authenticated using(exists(select 1 from public.crm_opportunities o where o.company_id=crm_card_catalog.company_id and o.id=crm_card_catalog.opportunity_id and crm_private.can_read_contact(o.company_id,o.contact_id)));
alter table public.crm_contact_catalog enable row level security;
revoke all on public.crm_contact_catalog from public,anon,authenticated,service_role;
grant select on public.crm_contact_catalog to authenticated;
create policy crm_contact_catalog_read on public.crm_contact_catalog for select to authenticated using(crm_private.can_read_contact(company_id,contact_id));

create function crm_private.core_initial_labels() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.crm_labels(company_id,name,color) values(new.id,'Frio','#3B82F6'),(new.id,'Morno','#F59E0B'),(new.id,'Quente','#EF4444');return new;
end;$$;
revoke all on function crm_private.core_initial_labels() from public,anon,authenticated,service_role;
create trigger core_initial_labels after insert on public.crm_companies for each row execute function crm_private.core_initial_labels();
insert into public.crm_labels(company_id,name,color) select c.id,x.name,x.color from public.crm_companies c cross join (values('Frio','#3B82F6'),('Morno','#F59E0B'),('Quente','#EF4444')) x(name,color);

-- Limite por card serializado pelo registro pai, inclusive em inserções concorrentes.
create function crm_private.core_limit_labels() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.crm_opportunities where company_id=new.company_id and id=new.opportunity_id for update;
 if not exists(select 1 from public.crm_card_labels where company_id=new.company_id and opportunity_id=new.opportunity_id and label_id=new.label_id)
 and (select count(*) from public.crm_card_labels where company_id=new.company_id and opportunity_id=new.opportunity_id)>=3 then
 raise exception 'CRM_LABEL_LIMIT' using errcode='23514';end if;return new;
end;$$;
revoke all on function crm_private.core_limit_labels() from public,anon,authenticated,service_role;
create trigger core_limit_labels before insert on public.crm_card_labels for each row execute function crm_private.core_limit_labels();

-- Compatibilidade: a temperatura anterior se torna etiqueta somente onde há um valor efetivamente registrado.
insert into public.crm_card_labels(company_id,opportunity_id,label_id)
 select o.company_id,o.id,l.id from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
 join public.crm_labels l on l.company_id=o.company_id and l.name=case c.temperature when 'cold' then 'Frio' when 'warm' then 'Morno' when 'hot' then 'Quente' end;

create function crm_private.core_create_board(p_company uuid,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.crm_boards;stage uuid;
begin
 perform crm_private.core_require_manager(p_company);
 if p_name is null or length(btrim(p_name)) not between 1 and 100 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for update;
 if exists(select 1 from public.crm_boards where company_id=p_company and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'CRM_NAME_EXISTS' using errcode='23505';end if;
 insert into public.crm_boards(company_id,kind,name,position) select p_company,'custom',btrim(p_name),coalesce(max(position)+1,0) from public.crm_boards where company_id=p_company returning * into result;
 insert into public.crm_stages(company_id,board_id,name,position) values(p_company,result.id,'Novo card',0) returning id into stage;
 return to_jsonb(result)||jsonb_build_object('stages',jsonb_build_array(jsonb_build_object('id',stage,'name','Novo card','position',0)));
end;
$$;

create function crm_private.core_configure_board(p_company uuid,p_board uuid,p_name text,p_stages jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare board public.crm_boards;old_stages jsonb;item record;removed record;target uuid;new_ids uuid[];
begin
 perform crm_private.core_require_manager(p_company);
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

create function crm_private.core_save_card(p_company uuid,p_card uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.crm_opportunities;result public.crm_opportunities;contact uuid;board uuid;stage uuid;strategy uuid;labels uuid[];items uuid[];label uuid;item uuid;
begin
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['contact_id','board_id','stage_id','title','value_cents','source','strategy_id','label_ids','catalog_ids','follow_up_at','is_closed'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 if p_card is not null then
  select * into previous from public.crm_opportunities where company_id=p_company and id=p_card for update;
  if not found or not crm_private.can_write_contact(p_company,previous.contact_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or previous.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 contact:=coalesce((p_values->>'contact_id')::uuid,previous.contact_id);
 if not crm_private.can_write_contact(p_company,contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
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

create function crm_private.core_set_contact_catalog(p_company uuid,p_contact uuid,p_items uuid[],p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.crm_contacts;item uuid;
begin
 if not crm_private.can_write_contact(p_company,p_contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 select * into c from public.crm_contacts where company_id=p_company and id=p_contact for update;
 if p_expected_version is null or p_expected_version<>c.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if p_items is null or array_position(p_items,null) is not null then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 foreach item in array p_items loop
  if not exists(select 1 from public.crm_catalog_items x where company_id=p_company and id=item and (active or exists(select 1 from public.crm_contact_catalog where company_id=p_company and contact_id=p_contact and catalog_id=item))) then raise exception 'CRM_INVALID_CATALOG_ITEM' using errcode='22023';end if;
 end loop;
 delete from public.crm_contact_catalog where company_id=p_company and contact_id=p_contact and not(catalog_id=any(p_items));
 insert into public.crm_contact_catalog(company_id,contact_id,catalog_id) select p_company,p_contact,x from (select distinct unnest(p_items) x) ids where not exists(select 1 from public.crm_contact_catalog where company_id=p_company and contact_id=p_contact and catalog_id=x);
 update public.crm_contacts set interests=interests where company_id=p_company and id=p_contact returning * into c;
 insert into public.crm_contact_history(company_id,contact_id,actor_user_id,actor_name,kind,title,body) values(p_company,p_contact,(select auth.uid()),coalesce((select display_name from public.crm_profiles where id=(select auth.uid())),'Usuário'),'contact_updated','Interesses atualizados','Serviços e produtos de interesse atualizados.');
 return to_jsonb(c)||jsonb_build_object('catalog_ids',to_jsonb(p_items));
end;
$$;

revoke all on function crm_private.core_create_board(uuid,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.core_create_board(uuid,text) to authenticated;
create function public.crm_create_board(p_company uuid,p_name text) returns jsonb language sql security invoker set search_path='' as $$select crm_private.core_create_board(p_company,p_name);$$;
revoke all on function public.crm_create_board(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_create_board(uuid,text) to authenticated;

revoke all on function crm_private.core_configure_board(uuid,uuid,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.core_configure_board(uuid,uuid,text,jsonb,bigint) to authenticated;
create function public.crm_configure_board(p_company uuid,p_board uuid,p_name text,p_stages jsonb,p_expected_version bigint) returns jsonb language sql security invoker set search_path='' as $$select crm_private.core_configure_board(p_company,p_board,p_name,p_stages,p_expected_version);$$;
revoke all on function public.crm_configure_board(uuid,uuid,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_configure_board(uuid,uuid,text,jsonb,bigint) to authenticated;

revoke all on function crm_private.core_save_card(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.core_save_card(uuid,uuid,jsonb,bigint) to authenticated;
create function public.crm_save_card(p_company uuid,p_card uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb language sql security invoker set search_path='' as $$select crm_private.core_save_card(p_company,p_card,p_values,p_expected_version);$$;
revoke all on function public.crm_save_card(uuid,uuid,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_card(uuid,uuid,jsonb,bigint) to authenticated;

revoke all on function crm_private.core_set_contact_catalog(uuid,uuid,uuid[],bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.core_set_contact_catalog(uuid,uuid,uuid[],bigint) to authenticated;
create function public.crm_set_contact_catalog(p_company uuid,p_contact uuid,p_items uuid[],p_expected_version bigint) returns jsonb language sql security invoker set search_path='' as $$select crm_private.core_set_contact_catalog(p_company,p_contact,p_items,p_expected_version);$$;
revoke all on function public.crm_set_contact_catalog(uuid,uuid,uuid[],bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_set_contact_catalog(uuid,uuid,uuid[],bigint) to authenticated;

-- Cards passam pelo comando transacional com versão e seleção de interesses.
revoke insert,update on public.crm_opportunities from authenticated;
revoke insert(company_id,contact_id,board_id,stage_id,value_cents,source),update(stage_id,value_cents,source) on public.crm_opportunities from authenticated;

create or replace function crm_private.log_contact_history() returns trigger
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
   elsif old.value_cents is distinct from new.value_cents or old.source is distinct from new.source or old.title is distinct from new.title or old.strategy_id is distinct from new.strategy_id or old.follow_up_at is distinct from new.follow_up_at or old.is_closed is distinct from new.is_closed then
    event_kind:='card_updated';event_title:='Card atualizado';event_body:='Dados da oportunidade atualizados.';
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
commit;
