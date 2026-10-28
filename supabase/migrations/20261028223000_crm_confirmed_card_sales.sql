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
