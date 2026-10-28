-- Registros explícitos de conclusão comercial, distintos de etapa Kanban e de pagamento.
create table public.crm_confirmed_sales(
  company_id uuid not null,
  opportunity_id uuid not null,
  membership_id uuid not null,
  value_cents bigint not null check (value_cents > 0 and value_cents <= 1000000000000),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  primary key(company_id,opportunity_id),
  foreign key(company_id,opportunity_id) references public.crm_opportunities(company_id,id) on delete restrict,
  foreign key(company_id,membership_id) references public.crm_memberships(company_id,id) on delete restrict
);
create index crm_confirmed_sales_month on public.crm_confirmed_sales(company_id,confirmed_at) where reversed_at is null;
alter table public.crm_confirmed_sales enable row level security;
create policy crm_confirmed_sales_read on public.crm_confirmed_sales for select to authenticated
using(crm_private.has_company_access(company_id) and
  (crm_private.company_role(company_id)='manager' or crm_private.owns_membership(company_id,membership_id)));
revoke all on public.crm_confirmed_sales from public,anon,authenticated;
grant select on public.crm_confirmed_sales to authenticated;

-- Apenas um ato explícito de confirmação conta para metas e medalhas.
create function crm_private.core_confirm_card_sale(
  p_company uuid,p_card uuid,p_stage uuid,p_expected_version bigint,p_amount_cents integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.crm_opportunities;owner uuid;stage_name text;result jsonb;
begin
  if (select auth.uid()) is null or not crm_private.has_company_access(p_company)
    or crm_private.company_role(p_company) not in ('manager','seller')
  then raise exception 'CRM_FORBIDDEN' using errcode='42501'; end if;
  select * into c from public.crm_opportunities
    where company_id=p_company and id=p_card for update;
  if not found or not crm_private.can_write_contact(p_company,c.contact_id)
  then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if c.row_version<>p_expected_version then
    raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
  if p_amount_cents is null or p_amount_cents<=0 then
    raise exception 'CRM_INVALID_CONFIRMED_VALUE' using errcode='22023';end if;
  select lower(translate(btrim(name),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'))
    into stage_name from public.crm_stages where company_id=p_company and board_id=c.board_id and id=p_stage;
  if stage_name is null or stage_name not in ('fechado','ganho','venda realizada','venda concluida','procedimento realizado','atendimento realizado')
  then raise exception 'CRM_NOT_A_SALE_STAGE' using errcode='22023';end if;
  if exists(select 1 from public.crm_confirmed_sales where company_id=p_company and opportunity_id=p_card and reversed_at is null)
  then raise exception 'CRM_SALE_ALREADY_CONFIRMED' using errcode='23505';end if;
  select co.owner_membership_id into owner from public.crm_contacts co
    join public.crm_memberships m on m.company_id=co.company_id and m.id=co.owner_membership_id
    where co.company_id=p_company and co.id=c.contact_id and m.active and m.role in ('seller','manager');
  if owner is null then raise exception 'CRM_SALE_OWNER_REQUIRED' using errcode='22023';end if;
  result:=crm_private.core_save_card(p_company,p_card,jsonb_build_object(
     'stage_id',p_stage,'value_cents',p_amount_cents),p_expected_version);
  insert into public.crm_confirmed_sales(company_id,opportunity_id,membership_id,value_cents,confirmed_at,confirmed_by,reversed_at)
  values(p_company,p_card,owner,p_amount_cents,now(),(select auth.uid()),null)
  on conflict(company_id,opportunity_id) do update set
    membership_id=excluded.membership_id,value_cents=excluded.value_cents,confirmed_at=excluded.confirmed_at,
    confirmed_by=excluded.confirmed_by,reversed_at=null;
  return result;
end;
$$;
revoke all on function crm_private.core_confirm_card_sale(uuid,uuid,uuid,bigint,integer)
  from public,anon,authenticated,service_role;
grant execute on function crm_private.core_confirm_card_sale(uuid,uuid,uuid,bigint,integer) to authenticated;
create function public.crm_confirm_card_sale(
  p_company uuid,p_card uuid,p_stage uuid,p_expected_version bigint,p_amount_cents integer
) returns jsonb language sql security invoker set search_path='' as $$
select crm_private.core_confirm_card_sale(p_company,p_card,p_stage,p_expected_version,p_amount_cents);
$$;
revoke all on function public.crm_confirm_card_sale(uuid,uuid,uuid,bigint,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.crm_confirm_card_sale(uuid,uuid,uuid,bigint,integer) to authenticated;

-- Se voltar da etapa de conclusão, a venda deixa de contar; mantemos rastreabilidade.
create function crm_private.reverse_confirmed_sale_when_leaving_stage() returns trigger
language plpgsql security definer set search_path='' as $$
declare stage_name text;
begin
  if new.stage_id is distinct from old.stage_id or new.board_id is distinct from old.board_id then
    select lower(translate(btrim(name),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'))
    into stage_name from public.crm_stages
    where company_id=new.company_id and board_id=new.board_id and id=new.stage_id;
    if stage_name not in ('fechado','ganho','venda realizada','venda concluida','procedimento realizado','atendimento realizado')
      or stage_name is null then
      update public.crm_confirmed_sales set reversed_at=now()
       where company_id=new.company_id and opportunity_id=new.id and reversed_at is null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.reverse_confirmed_sale_when_leaving_stage() from public,anon,authenticated,service_role;
create trigger crm_reverse_confirmed_sale after update of stage_id,board_id
on public.crm_opportunities for each row execute function crm_private.reverse_confirmed_sale_when_leaving_stage();

-- Preserva vendas confirmadas ao excluir etapas de Kanban.
create or replace function crm_private.core_configure_board(p_company uuid,p_board uuid,p_name text,p_stages jsonb,p_expected_version bigint) returns jsonb
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
  if exists(
    select 1 from public.crm_confirmed_sales sale
    join public.crm_opportunities o on o.company_id=sale.company_id and o.id=sale.opportunity_id
    where o.company_id=p_company and o.board_id=p_board and o.stage_id=removed.id
      and sale.reversed_at is null
   ) then
    raise exception 'CRM_CANNOT_REMOVE_STAGE_WITH_CONFIRMED_SALES' using errcode='23514';
   end if;
  update public.crm_opportunities set stage_id=target where company_id=p_company and board_id=p_board and stage_id=removed.id;
  delete from public.crm_stages where company_id=p_company and id=removed.id;
 end loop;
 update public.crm_boards set name=btrim(p_name),row_version=row_version+1 where id=p_board returning * into board;
 return to_jsonb(board)||jsonb_build_object('stages',(select jsonb_agg(to_jsonb(x) order by x.position) from public.crm_stages x where company_id=p_company and board_id=p_board));
end;
$$;
