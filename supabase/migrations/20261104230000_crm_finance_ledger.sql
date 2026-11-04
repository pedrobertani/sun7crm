-- Financeiro operacional multiempresa. Não mistura as cobranças da plataforma.
-- Somente vendas confirmadas geram contas a receber; confirmar venda NÃO cria receita recebida.
begin;

insert into crm_private.permission_catalog(key) values
 ('finance.view'),('finance.company'),('finance.terms'),('finance.receive'),
 ('finance.expense'),('finance.edit'),('finance.void'),('finance.export')
on conflict do nothing;

create table public.crm_finance_sales (
 company_id uuid not null,
 opportunity_id uuid not null,
 contact_id uuid not null,
 membership_id uuid not null,
 total_cents bigint not null check (total_cents between 1 and 1000000000000),
 cash_price_cents bigint not null check (cash_price_cents between 1 and 1000000000000),
 term_price_cents bigint not null check (term_price_cents between 1 and 1000000000000),
 payment_kind text not null default 'cash' check (payment_kind in ('cash','installments')),
 items_snapshot jsonb not null default '[]'::jsonb,
 contact_name_snapshot text not null default '',
 seller_name_snapshot text not null default '',
 confirmed_at timestamptz not null,
 cancelled_at timestamptz,
 row_version bigint not null default 1,
 updated_at timestamptz not null default now(),
 primary key(company_id,opportunity_id),
 foreign key(company_id,opportunity_id) references public.crm_confirmed_sales(company_id,opportunity_id) on delete restrict,
 foreign key(company_id,contact_id) references public.crm_contacts(company_id,id) on delete restrict,
 foreign key(company_id,membership_id) references public.crm_memberships(company_id,id) on delete restrict
);
create index crm_finance_sales_owner on public.crm_finance_sales(company_id,membership_id,confirmed_at desc);
create table public.crm_finance_installments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 opportunity_id uuid not null,
 installment_number smallint not null check (installment_number between 0 and 60),
 kind text not null check(kind in ('entry','installment')),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000000),
 due_on date not null,
 expected_method text not null default 'pix' check (expected_method in ('pix','cash','credit_card','debit_card','bank_transfer','other')),
 created_at timestamptz not null default now(),
 unique(company_id,id),
 unique(company_id,opportunity_id,installment_number),
 foreign key(company_id,opportunity_id) references public.crm_finance_sales(company_id,opportunity_id) on delete restrict
);
create index crm_finance_installments_due on public.crm_finance_installments(company_id,due_on);
create table public.crm_finance_movements (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.crm_companies(id) on delete restrict,
 opportunity_id uuid,
 installment_id uuid,
 owner_membership_id uuid not null,
 kind text not null check(kind in ('income','expense','refund')),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000000),
 method text not null check (method in ('pix','cash','credit_card','debit_card','bank_transfer','other')),
 posted_on date not null,
 category text not null default '' check(length(category)<=100),
 description text not null default '' check(length(description)<=500),
 origin_id uuid references public.crm_finance_movements(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 modified_at timestamptz not null default now(),
 row_version bigint not null default 1,
 voided_at timestamptz,
 void_reason text check (void_reason is null or length(btrim(void_reason)) between 5 and 500),
 unique(company_id,id),
 foreign key(company_id,owner_membership_id) references public.crm_memberships(company_id,id) on delete restrict,
 foreign key(company_id,opportunity_id) references public.crm_finance_sales(company_id,opportunity_id) on delete restrict,
 foreign key(company_id,installment_id) references public.crm_finance_installments(company_id,id) on delete restrict,
 check (
   (kind='expense' and installment_id is null and origin_id is null)
   or (kind='income' and installment_id is not null and opportunity_id is not null and origin_id is null)
   or (kind='refund' and installment_id is not null and opportunity_id is not null and origin_id is not null)
 )
);
create index crm_finance_movements_date on public.crm_finance_movements(company_id,posted_on desc,id);
create index crm_finance_movements_sale on public.crm_finance_movements(company_id,opportunity_id,kind);
create index crm_finance_movements_installment on public.crm_finance_movements(company_id,installment_id,kind);
create table public.crm_finance_audit(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.crm_companies(id) on delete restrict,
 movement_id uuid,
 opportunity_id uuid,
 owner_membership_id uuid not null,
 action text not null check(action in ('receipt','expense','edit_expense','void','refund','terms')),
 before_data jsonb,
 after_data jsonb,
 reason text not null default '',
 performed_by uuid not null references auth.users(id) on delete restrict,
 occurred_at timestamptz not null default now(),
 foreign key(company_id,owner_membership_id) references public.crm_memberships(company_id,id) on delete restrict
);
create index crm_finance_audit_company on public.crm_finance_audit(company_id,occurred_at desc);

alter table public.crm_finance_sales enable row level security;
alter table public.crm_finance_installments enable row level security;
alter table public.crm_finance_movements enable row level security;
alter table public.crm_finance_audit enable row level security;
revoke all on public.crm_finance_sales, public.crm_finance_installments,public.crm_finance_movements,public.crm_finance_audit from public,anon,authenticated,service_role;
grant select on public.crm_finance_sales, public.crm_finance_installments,public.crm_finance_movements,public.crm_finance_audit to authenticated;
create policy finance_sales_read on public.crm_finance_sales for select to authenticated using (
 crm_private.has_permission(company_id,'finance.view') and
 (crm_private.has_permission(company_id,'finance.company') or crm_private.owns_membership(company_id,membership_id))
);
create policy finance_installments_read on public.crm_finance_installments for select to authenticated using (
 crm_private.has_permission(company_id,'finance.view') and exists (
 select 1 from public.crm_finance_sales s where s.company_id=crm_finance_installments.company_id
 and s.opportunity_id=crm_finance_installments.opportunity_id
 and (crm_private.has_permission(s.company_id,'finance.company') or crm_private.owns_membership(s.company_id,s.membership_id))
 ));
create policy finance_movements_read on public.crm_finance_movements for select to authenticated using (
 crm_private.has_permission(company_id,'finance.view') and
 (crm_private.has_permission(company_id,'finance.company') or crm_private.owns_membership(company_id,owner_membership_id))
);
create policy finance_audit_read on public.crm_finance_audit for select to authenticated using (
 crm_private.has_permission(company_id,'finance.view') and
 (crm_private.has_permission(company_id,'finance.company') or crm_private.owns_membership(company_id,owner_membership_id))
);

-- Toda venda comercial confirmada gera uma conta pendente, nunca um pagamento automático.
create function crm_private.finance_sync_confirmed_sale() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous public.crm_finance_sales; items jsonb;
begin
  if new.reversed_at is not null then
    if exists (
      select 1 from public.crm_finance_movements m
      where m.company_id=new.company_id and m.opportunity_id=new.opportunity_id
      and m.voided_at is null and m.kind in ('income','refund')
      group by m.company_id,m.opportunity_id
      having sum(case when m.kind='income' then m.amount_cents else -m.amount_cents end)<>0
    ) then
      raise exception 'CRM_FINANCE_REFUND_BEFORE_REOPEN' using errcode='23514';
    end if;
    update public.crm_finance_sales set cancelled_at=new.reversed_at,updated_at=now(),row_version=row_version+1
     where company_id=new.company_id and opportunity_id=new.opportunity_id and cancelled_at is null;
    return new;
  end if;
  select * into previous from public.crm_finance_sales
   where company_id=new.company_id and opportunity_id=new.opportunity_id for update;
  if found and previous.cancelled_at is null then return new; end if;
  if found and exists (
    select 1 from public.crm_finance_movements
    where company_id=new.company_id and opportunity_id=new.opportunity_id
  ) then raise exception 'CRM_FINANCE_RECONFIRM_HISTORY' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
       'id',c.id,'name',c.name,'kind',c.kind,'unit_price_cents',c.value_cents,'quantity',1)
       order by c.name), '[]'::jsonb)
   into items from public.crm_card_catalog cc
   join public.crm_catalog_items c on c.company_id=cc.company_id and c.id=cc.catalog_id
   where cc.company_id=new.company_id and cc.opportunity_id=new.opportunity_id;
  insert into public.crm_finance_sales(company_id,opportunity_id,contact_id,membership_id,
    total_cents,cash_price_cents,term_price_cents,payment_kind,items_snapshot,contact_name_snapshot,
    seller_name_snapshot,confirmed_at,cancelled_at)
  select new.company_id,new.opportunity_id,o.contact_id,new.membership_id,new.value_cents,new.value_cents,
     new.value_cents,'cash',items,coalesce(c.name,''),coalesce(p.display_name,''),new.confirmed_at,null
  from public.crm_opportunities o
  join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
  join public.crm_memberships m on m.company_id=new.company_id and m.id=new.membership_id
  left join public.crm_profiles p on p.id=m.user_id
  where o.company_id=new.company_id and o.id=new.opportunity_id
  on conflict(company_id,opportunity_id) do update set
    total_cents=excluded.total_cents,cash_price_cents=excluded.cash_price_cents,
    term_price_cents=excluded.term_price_cents,payment_kind='cash',
    membership_id=excluded.membership_id,contact_id=excluded.contact_id,
    items_snapshot=excluded.items_snapshot,contact_name_snapshot=excluded.contact_name_snapshot,
    seller_name_snapshot=excluded.seller_name_snapshot,confirmed_at=excluded.confirmed_at,
    cancelled_at=null,row_version=crm_finance_sales.row_version+1,updated_at=now();
  delete from public.crm_finance_installments
   where company_id=new.company_id and opportunity_id=new.opportunity_id;
  insert into public.crm_finance_installments(company_id,opportunity_id,installment_number,kind,amount_cents,due_on,expected_method)
   values(new.company_id,new.opportunity_id,1,'installment',new.value_cents,(new.confirmed_at at time zone 'America/Sao_Paulo')::date,'pix');
  return new;
end $$;
revoke all on function crm_private.finance_sync_confirmed_sale() from public,anon,authenticated,service_role;
create trigger crm_finance_sale_sync after insert or update of reversed_at,value_cents on public.crm_confirmed_sales
  for each row execute function crm_private.finance_sync_confirmed_sale();

-- Backfill histórico comercial sem fingir que houve pagamento.
insert into public.crm_finance_sales(company_id,opportunity_id,contact_id,membership_id,total_cents,
 cash_price_cents,term_price_cents,payment_kind,items_snapshot,contact_name_snapshot,
 seller_name_snapshot,confirmed_at,cancelled_at)
select cs.company_id,cs.opportunity_id,o.contact_id,cs.membership_id,cs.value_cents,
 cs.value_cents,cs.value_cents,'cash',coalesce((
 select jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'kind',ci.kind,
 'unit_price_cents',ci.value_cents,'quantity',1) order by ci.name)
 from public.crm_card_catalog cc join public.crm_catalog_items ci on ci.company_id=cc.company_id and ci.id=cc.catalog_id
 where cc.company_id=cs.company_id and cc.opportunity_id=cs.opportunity_id), '[]'::jsonb),
 coalesce(c.name,''),coalesce(p.display_name,''),cs.confirmed_at,cs.reversed_at
from public.crm_confirmed_sales cs
join public.crm_opportunities o on o.company_id=cs.company_id and o.id=cs.opportunity_id
join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
join public.crm_memberships m on m.company_id=cs.company_id and m.id=cs.membership_id
left join public.crm_profiles p on p.id=m.user_id
on conflict(company_id,opportunity_id) do nothing;
insert into public.crm_finance_installments(company_id,opportunity_id,installment_number,kind,amount_cents,due_on)
 select company_id,opportunity_id,1,'installment',total_cents,(confirmed_at at time zone 'America/Sao_Paulo')::date
 from public.crm_finance_sales
 on conflict(company_id,opportunity_id,installment_number) do nothing;

create function crm_private.finance_guard(p_company uuid,p_owner uuid,p_permission text)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform crm_private.require_permission(p_company,p_permission);
 if not (crm_private.has_permission(p_company,'finance.company') or
     crm_private.owns_membership(p_company,p_owner)) then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
 end if;
end $$;
revoke all on function crm_private.finance_guard(uuid,uuid,text) from public,anon,authenticated,service_role;

create function crm_private.finance_set_terms(
 p_company uuid,p_card uuid,p_cash bigint,p_term bigint,p_kind text,p_schedule jsonb,p_version bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare sale public.crm_finance_sales; row jsonb; n integer:=0; amount bigint; total bigint:=0;
 due_date date; method text; expected bigint; is_entry boolean;
begin
 select * into sale from public.crm_finance_sales
  where company_id=p_company and opportunity_id=p_card for update;
 if not found or sale.cancelled_at is not null then raise exception 'CRM_FINANCE_SALE_NOT_ACTIVE' using errcode='22023'; end if;
 perform crm_private.finance_guard(p_company,sale.membership_id,'finance.terms');
 if p_version is null or sale.row_version<>p_version then raise exception 'CRM_STALE_VERSION' using errcode='40001'; end if;
 if p_cash is null or p_term is null or p_cash not between 1 and 1000000000000
  or p_term not between 1 and 1000000000000 or p_kind not in ('cash','installments')
  or (p_kind='cash' and sale.total_cents<>p_cash)
  or (p_kind='installments' and sale.total_cents<>p_term)
 then raise exception 'CRM_FINANCE_INVALID_TERMS' using errcode='22023'; end if;
 if jsonb_typeof(p_schedule) is distinct from 'array'
  or jsonb_array_length(p_schedule) not between 1 and 61
  or (p_kind='cash' and jsonb_array_length(p_schedule)<>1)
 then raise exception 'CRM_FINANCE_INVALID_SCHEDULE' using errcode='22023'; end if;
 if exists(select 1 from public.crm_finance_movements
   where company_id=p_company and opportunity_id=p_card)
 then raise exception 'CRM_FINANCE_ALREADY_HAS_MOVEMENTS' using errcode='23514'; end if;
 delete from public.crm_finance_installments
   where company_id=p_company and opportunity_id=p_card;
 for row in select value from jsonb_array_elements(p_schedule) loop
   n:=n+1;
   if jsonb_typeof(row->'amount_cents') is distinct from 'number'
      or (row->>'amount_cents')::numeric<>trunc((row->>'amount_cents')::numeric)
      or (row->>'amount_cents')::numeric not between 1 and 1000000000000
      or jsonb_typeof(row->'due_on') is distinct from 'string'
   then raise exception 'CRM_FINANCE_INVALID_SCHEDULE' using errcode='22023';end if;
   amount:=(row->>'amount_cents')::bigint;
   due_date:=(row->>'due_on')::date;
   method:=coalesce(row->>'method','pix');
   is_entry:=coalesce((row->>'entry')::boolean,false);
   if method not in ('pix','cash','credit_card','debit_card','bank_transfer','other')
      or due_date not between date '2020-01-01' and (current_date + interval '15 years')::date
      or (is_entry and (n<>1 or p_kind='cash'))
   then raise exception 'CRM_FINANCE_INVALID_SCHEDULE' using errcode='22023';end if;
   total:=total+amount;
   insert into public.crm_finance_installments(company_id,opportunity_id,installment_number,kind,amount_cents,due_on,expected_method)
    values(p_company,p_card,case when is_entry then 0 else n - case when (p_schedule->0->>'entry')::boolean is true then 1 else 0 end end,
      case when is_entry then 'entry' else 'installment' end,amount,due_date,method);
 end loop;
 if total<>sale.total_cents then raise exception 'CRM_FINANCE_SCHEDULE_SUM_MISMATCH' using errcode='23514';end if;
 update public.crm_finance_sales set cash_price_cents=p_cash,term_price_cents=p_term,payment_kind=p_kind,
   row_version=row_version+1,updated_at=now()
 where company_id=p_company and opportunity_id=p_card returning * into sale;
 insert into public.crm_finance_audit(company_id,opportunity_id,owner_membership_id,action,after_data,performed_by)
 values(p_company,p_card,sale.membership_id,'terms',
   jsonb_build_object('kind',p_kind,'cash_cents',p_cash,'term_cents',p_term,'schedule',p_schedule),(select auth.uid()));
 return to_jsonb(sale);
end $$;
revoke all on function crm_private.finance_set_terms(uuid,uuid,bigint,bigint,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.finance_set_terms(uuid,uuid,bigint,bigint,text,jsonb,bigint) to authenticated;
create function public.crm_finance_set_terms(
 p_company uuid,p_card uuid,p_cash bigint,p_term bigint,p_kind text,p_schedule jsonb,p_version bigint
) returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.finance_set_terms(p_company,p_card,p_cash,p_term,p_kind,p_schedule,p_version)
$$;
revoke all on function public.crm_finance_set_terms(uuid,uuid,bigint,bigint,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_set_terms(uuid,uuid,bigint,bigint,text,jsonb,bigint) to authenticated;

-- Confirmação + condições são uma transação; não permite venda gravada sem suas parcelas.
create function public.crm_confirm_card_sale_finance(
 p_company uuid,p_card uuid,p_stage uuid,p_expected_version bigint,p_amount_cents integer,
 p_cash bigint,p_term bigint,p_kind text,p_schedule jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb;
begin
 perform crm_private.require_permission(p_company,'finance.terms');
 saved:=public.crm_confirm_card_sale(p_company,p_card,p_stage,p_expected_version,p_amount_cents);
 perform crm_private.finance_set_terms(p_company,p_card,p_cash,p_term,p_kind,p_schedule,1);
 return saved;
end $$;
revoke all on function public.crm_confirm_card_sale_finance(uuid,uuid,uuid,bigint,integer,bigint,bigint,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_confirm_card_sale_finance(uuid,uuid,uuid,bigint,integer,bigint,bigint,text,jsonb) to authenticated;

create function crm_private.finance_record_receipt(
 p_company uuid,p_installment uuid,p_request uuid,p_amount bigint,p_method text,p_date date,p_description text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ins public.crm_finance_installments; sale public.crm_finance_sales; movement public.crm_finance_movements;
 received bigint;
begin
 if p_request is null then raise exception 'CRM_FINANCE_REQUEST_REQUIRED' using errcode='22023';end if;
 select * into movement from public.crm_finance_movements where company_id=p_company and id=p_request;
 if found then
   perform crm_private.finance_guard(p_company,movement.owner_membership_id,'finance.receive');
   if movement.company_id=p_company and movement.installment_id=p_installment and movement.kind='income'
     and movement.amount_cents=p_amount and movement.method=p_method and movement.posted_on=p_date
     and movement.description=coalesce(p_description,'') and movement.voided_at is null
   then return to_jsonb(movement);end if;
   raise exception 'CRM_FINANCE_REQUEST_CONFLICT' using errcode='23505';
 end if;
 select * into ins from public.crm_finance_installments
  where company_id=p_company and id=p_installment for update;
 if not found then raise exception 'CRM_FINANCE_NOT_FOUND' using errcode='P0002';end if;
 select * into sale from public.crm_finance_sales
  where company_id=p_company and opportunity_id=ins.opportunity_id;
 if sale.cancelled_at is not null then raise exception 'CRM_FINANCE_SALE_NOT_ACTIVE' using errcode='22023';end if;
 perform crm_private.finance_guard(p_company,sale.membership_id,'finance.receive');
 if p_amount is null or p_amount<=0 or p_method not in ('pix','cash','credit_card','debit_card','bank_transfer','other')
   or p_date is null or p_date not between date '2020-01-01' and (current_date + interval '15 years')::date
   or length(coalesce(p_description,''))>500
 then raise exception 'CRM_FINANCE_INVALID_RECEIPT' using errcode='22023';end if;
 select coalesce(sum(case when kind='income' then amount_cents else -amount_cents end),0)
  into received from public.crm_finance_movements
  where company_id=p_company and installment_id=p_installment
   and kind in ('income','refund') and voided_at is null;
 if p_amount>ins.amount_cents-received then raise exception 'CRM_FINANCE_OVERPAYMENT' using errcode='23514';end if;
 insert into public.crm_finance_movements(id,company_id,opportunity_id,installment_id,owner_membership_id,
  kind,amount_cents,method,posted_on,description,created_by)
 values(p_request,p_company,ins.opportunity_id,p_installment,sale.membership_id,
  'income',p_amount,p_method,p_date,coalesce(p_description,''),(select auth.uid())) returning * into movement;
 insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,action,after_data,performed_by)
 values(p_company,movement.id,ins.opportunity_id,sale.membership_id,'receipt',to_jsonb(movement),(select auth.uid()));
 return to_jsonb(movement);
end $$;
revoke all on function crm_private.finance_record_receipt(uuid,uuid,uuid,bigint,text,date,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.finance_record_receipt(uuid,uuid,uuid,bigint,text,date,text) to authenticated;
create function public.crm_finance_record_receipt(p_company uuid,p_installment uuid,p_request uuid,p_amount bigint,p_method text,p_date date,p_description text default '')
returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.finance_record_receipt(p_company,p_installment,p_request,p_amount,p_method,p_date,p_description)
$$;
revoke all on function public.crm_finance_record_receipt(uuid,uuid,uuid,bigint,text,date,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_record_receipt(uuid,uuid,uuid,bigint,text,date,text) to authenticated;

create function crm_private.finance_save_expense(
 p_company uuid,p_id uuid,p_amount bigint,p_method text,p_date date,p_category text,p_description text,
 p_owner uuid,p_opportunity uuid,p_version bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.crm_finance_movements; before_value jsonb; owner_id uuid;
begin
 if p_id is null or p_amount is null or p_amount not between 1 and 1000000000000
  or p_method not in ('pix','cash','credit_card','debit_card','bank_transfer','other')
  or p_date is null or p_date not between date '2020-01-01' and (current_date + interval '15 years')::date
  or length(btrim(coalesce(p_category,''))) not between 1 and 100
  or length(coalesce(p_description,''))>500 then
  raise exception 'CRM_FINANCE_INVALID_EXPENSE' using errcode='22023';end if;
 select id into owner_id from public.crm_memberships where company_id=p_company and user_id=(select auth.uid()) and active;
 if owner_id is null then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 owner_id:=coalesce(p_owner,owner_id);
 perform crm_private.finance_guard(p_company,owner_id,case when p_version is null then 'finance.expense' else 'finance.edit' end);
 if not exists(select 1 from public.crm_memberships where company_id=p_company and id=owner_id and active)
 then raise exception 'CRM_FINANCE_INVALID_OWNER' using errcode='22023';end if;
 if p_opportunity is not null and not exists (
   select 1 from public.crm_finance_sales where company_id=p_company and opportunity_id=p_opportunity
    and (crm_private.has_permission(p_company,'finance.company') or membership_id=owner_id)
 ) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_version is null then
   select * into m from public.crm_finance_movements where company_id=p_company and id=p_id;
   if found then
     perform crm_private.finance_guard(p_company,m.owner_membership_id,'finance.expense');
     if m.company_id=p_company and m.kind='expense' and m.voided_at is null
     and m.owner_membership_id=owner_id and m.opportunity_id is not distinct from p_opportunity
     and m.amount_cents=p_amount and m.method=p_method and m.posted_on=p_date
     and m.category=btrim(p_category) and m.description=coalesce(p_description,'')
     then return to_jsonb(m);end if;
     raise exception 'CRM_FINANCE_REQUEST_CONFLICT' using errcode='23505';
   end if;
   insert into public.crm_finance_movements(id,company_id,opportunity_id,owner_membership_id,
    kind,amount_cents,method,posted_on,category,description,created_by)
   values(p_id,p_company,p_opportunity,owner_id,'expense',p_amount,p_method,p_date,btrim(p_category),
    coalesce(p_description,''),(select auth.uid())) returning * into m;
   insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,action,after_data,performed_by)
   values(p_company,m.id,p_opportunity,owner_id,'expense',to_jsonb(m),(select auth.uid()));
 else
   select * into m from public.crm_finance_movements where company_id=p_company and id=p_id for update;
   if not found or m.kind<>'expense' or m.voided_at is not null then
    raise exception 'CRM_FINANCE_NOT_EDITABLE' using errcode='22023';end if;
   perform crm_private.finance_guard(p_company,m.owner_membership_id,'finance.edit');
   if m.row_version<>p_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
   before_value:=to_jsonb(m);
   update public.crm_finance_movements set amount_cents=p_amount,method=p_method,posted_on=p_date,
     category=btrim(p_category),description=coalesce(p_description,''),opportunity_id=p_opportunity,
     owner_membership_id=owner_id,row_version=row_version+1,modified_at=now()
   where company_id=p_company and id=p_id returning * into m;
   insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,
    action,before_data,after_data,performed_by)
   values(p_company,m.id,p_opportunity,owner_id,'edit_expense',before_value,to_jsonb(m),(select auth.uid()));
 end if;
 return to_jsonb(m);
end $$;
revoke all on function crm_private.finance_save_expense(uuid,uuid,bigint,text,date,text,text,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.finance_save_expense(uuid,uuid,bigint,text,date,text,text,uuid,uuid,bigint) to authenticated;
create function public.crm_finance_save_expense(p_company uuid,p_id uuid,p_amount bigint,p_method text,p_date date,
 p_category text,p_description text default '',p_owner uuid default null,p_opportunity uuid default null,p_version bigint default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.finance_save_expense(p_company,p_id,p_amount,p_method,p_date,p_category,p_description,p_owner,p_opportunity,p_version)
$$;
revoke all on function public.crm_finance_save_expense(uuid,uuid,bigint,text,date,text,text,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_save_expense(uuid,uuid,bigint,text,date,text,text,uuid,uuid,bigint) to authenticated;

create function crm_private.finance_refund(
 p_company uuid,p_receipt uuid,p_request uuid,p_amount bigint,p_date date,p_method text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.crm_finance_movements; m public.crm_finance_movements; refunded bigint;
begin
 if p_request is null then raise exception 'CRM_FINANCE_REQUEST_REQUIRED' using errcode='22023';end if;
 select * into m from public.crm_finance_movements where company_id=p_company and id=p_request;
 if found then
  perform crm_private.finance_guard(p_company,m.owner_membership_id,'finance.void');
  if m.company_id=p_company and m.kind='refund' and m.origin_id=p_receipt
    and m.amount_cents=p_amount and m.method=p_method and m.posted_on=p_date
    and m.description=btrim(p_reason) and m.voided_at is null
  then return to_jsonb(m);end if;
  raise exception 'CRM_FINANCE_REQUEST_CONFLICT' using errcode='23505';
 end if;
 select * into original from public.crm_finance_movements
  where company_id=p_company and id=p_receipt and kind='income' for update;
 if not found or original.voided_at is not null then raise exception 'CRM_FINANCE_NOT_FOUND' using errcode='P0002';end if;
 perform crm_private.finance_guard(p_company,original.owner_membership_id,'finance.void');
 if p_amount is null or p_amount<1 or p_date is null or p_method not in ('pix','cash','credit_card','debit_card','bank_transfer','other')
  or length(btrim(coalesce(p_reason,''))) not between 5 and 500
 then raise exception 'CRM_FINANCE_INVALID_REFUND' using errcode='22023';end if;
 select coalesce(sum(amount_cents),0) into refunded
  from public.crm_finance_movements where company_id=p_company and origin_id=p_receipt and kind='refund' and voided_at is null;
 if p_amount>original.amount_cents-refunded then raise exception 'CRM_FINANCE_REFUND_TOO_HIGH' using errcode='23514';end if;
 insert into public.crm_finance_movements(id,company_id,opportunity_id,installment_id,owner_membership_id,
   kind,amount_cents,method,posted_on,description,origin_id,created_by)
 values(p_request,p_company,original.opportunity_id,original.installment_id,original.owner_membership_id,
   'refund',p_amount,p_method,p_date,btrim(p_reason),p_receipt,(select auth.uid())) returning * into m;
 insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,action,after_data,reason,performed_by)
 values(p_company,m.id,m.opportunity_id,m.owner_membership_id,'refund',to_jsonb(m),p_reason,(select auth.uid()));
 return to_jsonb(m);
end $$;
revoke all on function crm_private.finance_refund(uuid,uuid,uuid,bigint,date,text,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.finance_refund(uuid,uuid,uuid,bigint,date,text,text) to authenticated;
create function public.crm_finance_refund(p_company uuid,p_receipt uuid,p_request uuid,p_amount bigint,p_date date,p_method text,p_reason text)
 returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.finance_refund(p_company,p_receipt,p_request,p_amount,p_date,p_method,p_reason)
$$;
revoke all on function public.crm_finance_refund(uuid,uuid,uuid,bigint,date,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_refund(uuid,uuid,uuid,bigint,date,text,text) to authenticated;

create function public.crm_finance_void_movement(p_company uuid,p_movement uuid,p_version bigint,p_reason text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.crm_finance_movements; before_value jsonb;
begin
 select * into m from public.crm_finance_movements where company_id=p_company and id=p_movement for update;
 if not found or m.voided_at is not null or m.kind='refund' then
  raise exception 'CRM_FINANCE_NOT_EDITABLE' using errcode='22023';end if;
 perform crm_private.finance_guard(p_company,m.owner_membership_id,'finance.void');
 if p_version is null or p_version<>m.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
  raise exception 'CRM_FINANCE_REASON_REQUIRED' using errcode='22023';end if;
 if m.kind='income' and exists(select 1 from public.crm_finance_movements
  where company_id=p_company and origin_id=m.id and kind='refund' and voided_at is null)
 then raise exception 'CRM_FINANCE_REFUND_ALREADY_EXISTS' using errcode='23514';end if;
 before_value:=to_jsonb(m);
 update public.crm_finance_movements set voided_at=now(),void_reason=btrim(p_reason),
  row_version=row_version+1,modified_at=now()
 where company_id=p_company and id=p_movement returning * into m;
 insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,action,
  before_data,after_data,reason,performed_by)
 values(p_company,m.id,m.opportunity_id,m.owner_membership_id,'void',before_value,to_jsonb(m),p_reason,(select auth.uid()));
 return to_jsonb(m);
end $$;
revoke all on function public.crm_finance_void_movement(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_void_movement(uuid,uuid,bigint,text) to authenticated;

commit;