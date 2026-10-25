-- Embaixadores: registros administrativos, sem transferência bancária ou API de pagamento.
begin;
create table public.crm_ambassadors(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,contact_id uuid not null,
 category text not null default '' check(length(category)<=80),benefits text not null default '' check(length(benefits)<=5000),
 commission_enabled boolean not null default false,active boolean not null default true,
 referral_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) check(referral_code ~ '^[A-Z0-9_-]{3,32}$'),
 created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,contact_id),unique(company_id,referral_code),
 foreign key(company_id,contact_id) references public.crm_contacts(company_id,id));
create table public.crm_ambassador_campaigns(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.crm_companies(id),
 name text not null check(length(btrim(name)) between 1 and 160),starts_on date not null,ends_on date not null check(ends_on>=starts_on),
 payment_mode text not null check(payment_mode in ('per_point','percentage')),
 rate_cents integer not null default 0 check(rate_cents>=0),rate_bps integer not null default 0 check(rate_bps between 0 and 10000),
 status text not null default 'active' check(status in ('active','closed')),closed_at timestamptz,closed_by uuid references public.crm_profiles(id),closed_request_id uuid unique,
 row_version bigint not null default 1,created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),check((payment_mode='per_point' and rate_bps=0) or (payment_mode='percentage' and rate_cents=0)),
 check((status='closed')=(closed_at is not null and closed_by is not null and closed_request_id is not null)));
create index crm_campaigns_company_status_idx on public.crm_ambassador_campaigns(company_id,status,starts_on);
create index crm_campaigns_closed_by_idx on public.crm_ambassador_campaigns(closed_by);
create table public.crm_ambassador_referrals(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,campaign_id uuid not null,ambassador_id uuid not null,
 opportunity_id uuid not null,contact_id uuid not null,value_cents integer not null check(value_cents>0),sold_on date not null,
 paid boolean not null default false,attended boolean not null default false,cancelled boolean not null default false,
 refunded_cents integer not null default 0 check(refunded_cents>=0 and refunded_cents<=value_cents),row_version bigint not null default 1,
 created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,campaign_id,opportunity_id),
 foreign key(company_id,campaign_id) references public.crm_ambassador_campaigns(company_id,id),
 foreign key(company_id,ambassador_id) references public.crm_ambassadors(company_id,id),
 foreign key(company_id,opportunity_id) references public.crm_opportunities(company_id,id),
 foreign key(company_id,contact_id) references public.crm_contacts(company_id,id));
create index crm_referrals_ambassador_idx on public.crm_ambassador_referrals(company_id,ambassador_id,campaign_id);
create index crm_referrals_opportunity_idx on public.crm_ambassador_referrals(company_id,opportunity_id);
create index crm_referrals_contact_idx on public.crm_ambassador_referrals(company_id,contact_id);
create table public.crm_referral_catalog(
 company_id uuid not null,referral_id uuid not null,catalog_id uuid not null,primary key(company_id,referral_id,catalog_id),
 foreign key(company_id,referral_id) references public.crm_ambassador_referrals(company_id,id),
 foreign key(company_id,catalog_id) references public.crm_catalog_items(company_id,id));
create index crm_referral_catalog_item_idx on public.crm_referral_catalog(company_id,catalog_id);
create table public.crm_campaign_participants(
 company_id uuid not null,campaign_id uuid not null,ambassador_id uuid not null,
 ambassador_name text not null,category text not null,commission_enabled boolean not null,
 primary key(company_id,campaign_id,ambassador_id),
 foreign key(company_id,campaign_id) references public.crm_ambassador_campaigns(company_id,id),
 foreign key(company_id,ambassador_id) references public.crm_ambassadors(company_id,id));
create index crm_participants_ambassador_idx on public.crm_campaign_participants(company_id,ambassador_id);
create table public.crm_campaign_payments(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,company_id uuid not null,campaign_id uuid not null,ambassador_id uuid not null,
 ambassador_name text not null,actor_user_id uuid not null references public.crm_profiles(id),eligible_cents bigint not null check(eligible_cents>=0),
 points bigint not null check(points>=0),amount_cents bigint not null check(amount_cents>0 and amount_cents<=9007199254740991),
 note text not null default '' check(length(note)<=500),fingerprint text not null,paid_at timestamptz not null default statement_timestamp(),
 unique(company_id,campaign_id,ambassador_id),
 foreign key(company_id,campaign_id) references public.crm_ambassador_campaigns(company_id,id),
 foreign key(company_id,ambassador_id) references public.crm_ambassadors(company_id,id));
create index crm_campaign_payments_ambassador_idx on public.crm_campaign_payments(company_id,ambassador_id);
create index crm_campaign_payments_actor_idx on public.crm_campaign_payments(actor_user_id);
create table public.crm_referral_revisions(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,company_id uuid not null,referral_id uuid not null,
 actor_user_id uuid not null references public.crm_profiles(id),kind text not null check(kind in ('created','updated','adjusted')),
 fingerprint text not null,reason text not null default '' check(length(reason)<=500),result jsonb not null,
 created_at timestamptz not null default statement_timestamp(),foreign key(company_id,referral_id) references public.crm_ambassador_referrals(company_id,id));
create index crm_referral_revisions_ref_idx on public.crm_referral_revisions(company_id,referral_id,created_at desc);
create index crm_referral_revisions_actor_idx on public.crm_referral_revisions(actor_user_id);
create table public.crm_ambassador_metrics(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,ambassador_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 80),value numeric(18,2) not null check(value>=0),unit text not null default '' check(length(unit)<=30),measured_on date not null,
 source text not null default 'manual' check(source='manual'),created_by uuid default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(company_id,ambassador_id) references public.crm_ambassadors(company_id,id));
create index crm_ambassador_metrics_company_idx on public.crm_ambassador_metrics(company_id,ambassador_id,measured_on);
alter table public.crm_ambassadors enable row level security;
revoke all on public.crm_ambassadors from public,anon,authenticated,service_role;
grant select on public.crm_ambassadors to authenticated;
create policy crm_ambassadors_read on public.crm_ambassadors for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_ambassador_campaigns enable row level security;
revoke all on public.crm_ambassador_campaigns from public,anon,authenticated,service_role;
grant select on public.crm_ambassador_campaigns to authenticated;
create policy crm_ambassador_campaigns_read on public.crm_ambassador_campaigns for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_ambassador_referrals enable row level security;
revoke all on public.crm_ambassador_referrals from public,anon,authenticated,service_role;
grant select on public.crm_ambassador_referrals to authenticated;
create policy crm_ambassador_referrals_read on public.crm_ambassador_referrals for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_referral_catalog enable row level security;
revoke all on public.crm_referral_catalog from public,anon,authenticated,service_role;
grant select on public.crm_referral_catalog to authenticated;
create policy crm_referral_catalog_read on public.crm_referral_catalog for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_campaign_participants enable row level security;
revoke all on public.crm_campaign_participants from public,anon,authenticated,service_role;
grant select on public.crm_campaign_participants to authenticated;
create policy crm_campaign_participants_read on public.crm_campaign_participants for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_campaign_payments enable row level security;
revoke all on public.crm_campaign_payments from public,anon,authenticated,service_role;
grant select on public.crm_campaign_payments to authenticated;
create policy crm_campaign_payments_read on public.crm_campaign_payments for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_referral_revisions enable row level security;
revoke all on public.crm_referral_revisions from public,anon,authenticated,service_role;
grant select on public.crm_referral_revisions to authenticated;
create policy crm_referral_revisions_read on public.crm_referral_revisions for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
alter table public.crm_ambassador_metrics enable row level security;
revoke all on public.crm_ambassador_metrics from public,anon,authenticated,service_role;
grant select on public.crm_ambassador_metrics to authenticated;
create policy crm_ambassador_metrics_read on public.crm_ambassador_metrics for select to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_ambassadors_insert on public.crm_ambassadors for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_ambassadors_update on public.crm_ambassadors for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create trigger protect_crm_ambassadors before update on public.crm_ambassadors for each row execute function crm_private.protect_identity_and_touch();
create policy crm_ambassador_campaigns_insert on public.crm_ambassador_campaigns for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_ambassador_campaigns_update on public.crm_ambassador_campaigns for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create trigger protect_crm_ambassador_campaigns before update on public.crm_ambassador_campaigns for each row execute function crm_private.protect_identity_and_touch();
create policy crm_ambassador_metrics_insert on public.crm_ambassador_metrics for insert to authenticated with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_ambassador_metrics_update on public.crm_ambassador_metrics for update to authenticated using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager') with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create trigger protect_crm_ambassador_metrics before update on public.crm_ambassador_metrics for each row execute function crm_private.protect_identity_and_touch();
create trigger audit_crm_ambassadors after insert or update on public.crm_ambassadors for each row execute function crm_private.audit_change();
create trigger audit_crm_ambassador_campaigns after insert or update on public.crm_ambassador_campaigns for each row execute function crm_private.audit_change();
create trigger audit_crm_ambassador_referrals after insert or update on public.crm_ambassador_referrals for each row execute function crm_private.audit_change();
create trigger audit_crm_campaign_payments after insert or update on public.crm_campaign_payments for each row execute function crm_private.audit_change();
create trigger audit_crm_referral_revisions after insert or update on public.crm_referral_revisions for each row execute function crm_private.audit_change();
create trigger audit_crm_ambassador_metrics after insert or update on public.crm_ambassador_metrics for each row execute function crm_private.audit_change();
grant insert(company_id,contact_id,category,benefits,commission_enabled,active,referral_code) on public.crm_ambassadors to authenticated;
grant update(category,benefits,commission_enabled,active,referral_code) on public.crm_ambassadors to authenticated;
grant insert(company_id,name,starts_on,ends_on,payment_mode,rate_cents,rate_bps) on public.crm_ambassador_campaigns to authenticated;
grant update(name,starts_on,ends_on,payment_mode,rate_cents,rate_bps) on public.crm_ambassador_campaigns to authenticated;
grant insert(company_id,ambassador_id,name,value,unit,measured_on) on public.crm_ambassador_metrics to authenticated;
grant update(name,value,unit,measured_on) on public.crm_ambassador_metrics to authenticated;
create trigger campaign_version before update on public.crm_ambassador_campaigns for each row execute function crm_private.core_touch_version();
create trigger referral_version before update on public.crm_ambassador_referrals for each row execute function crm_private.core_touch_version();
create trigger protect_referrals before update on public.crm_ambassador_referrals for each row execute function crm_private.protect_identity_and_touch();

create function crm_private.amb_campaign_closed_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin if old.status='closed' then raise exception 'CRM_CAMPAIGN_CLOSED' using errcode='23514';end if;return new;end;$$;
revoke all on function crm_private.amb_campaign_closed_guard() from public,anon,authenticated,service_role;
create trigger campaign_closed_guard before update on public.crm_ambassador_campaigns for each row execute function crm_private.amb_campaign_closed_guard();

-- Valores inteiros em centavos; percentual em pontos-base (1%=100). A referência de ponto é sempre R$1.000.
create view public.crm_ambassador_campaign_totals with(security_invoker=true) as
with sales as (
 select r.company_id,r.campaign_id,r.ambassador_id,count(*)::bigint as indicated_count,
 count(*) filter(where r.attended and not r.cancelled)::bigint as attended_count,
 count(*) filter(where r.paid and not r.cancelled)::bigint as paid_count,
 coalesce(sum(greatest(0,r.value_cents-r.refunded_cents)) filter(where r.paid and r.attended and not r.cancelled and r.sold_on between c.starts_on and c.ends_on and r.sold_on<=(statement_timestamp() at time zone 'America/Sao_Paulo')::date),0)::bigint as eligible_cents
 from public.crm_ambassador_referrals r join public.crm_ambassador_campaigns c on c.company_id=r.company_id and c.id=r.campaign_id group by r.company_id,r.campaign_id,r.ambassador_id
), base as (
 select c.company_id,c.id as campaign_id,a.id as ambassador_id,coalesce(cp.ambassador_name,person.name) as ambassador_name,
 coalesce(cp.category,a.category) as category,
 case when c.status='closed' then coalesce(cp.commission_enabled,false) else a.commission_enabled end as commission_enabled,
 coalesce(s.indicated_count,0) as indicated_count,coalesce(s.attended_count,0) as attended_count,coalesce(s.paid_count,0) as paid_count,
 coalesce(s.eligible_cents,0)::bigint as eligible_cents,(coalesce(s.eligible_cents,0)/100000)::bigint as points,
 c.payment_mode,c.rate_cents,c.rate_bps,p.id as payment_id,coalesce(p.points,0)::bigint as paid_points,coalesce(p.amount_cents,0)::bigint as paid_cents
 from public.crm_ambassador_campaigns c join public.crm_ambassadors a on a.company_id=c.company_id
 join public.crm_contacts person on person.company_id=a.company_id and person.id=a.contact_id
 left join sales s on s.company_id=c.company_id and s.campaign_id=c.id and s.ambassador_id=a.id
 left join public.crm_campaign_participants cp on cp.company_id=c.company_id and cp.campaign_id=c.id and cp.ambassador_id=a.id
 left join public.crm_campaign_payments p on p.company_id=c.company_id and p.campaign_id=c.id and p.ambassador_id=a.id
), totals as (
 select *,case when not commission_enabled then 0::numeric when payment_mode='per_point' then points::numeric*rate_cents
 else round(eligible_cents::numeric*rate_bps/10000) end as amount_cents from base
)
select company_id,campaign_id,ambassador_id,ambassador_name,category,commission_enabled,indicated_count,attended_count,paid_count,
 eligible_cents,points,amount_cents,paid_cents,paid_points,amount_cents-paid_cents as balance_cents,
 greatest(0,points-paid_points)::bigint as remaining_points,payment_id is not null as settled
from totals;
revoke all on public.crm_ambassador_campaign_totals from public,anon,authenticated,service_role;
grant select on public.crm_ambassador_campaign_totals to authenticated;

create function crm_private.amb_save_referral(p_company uuid,p_referral uuid,p_campaign uuid,p_ambassador uuid,p_opportunity uuid,p_values jsonb,p_request_id uuid,p_expected_version bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;r public.crm_ambassador_referrals;o public.crm_opportunities;previous public.crm_referral_revisions;hash text;items uuid[];item uuid;
begin
 perform crm_private.core_require_manager(p_company);
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
 if not exists(select 1 from public.crm_ambassadors where company_id=p_company and id=p_ambassador and (active or p_referral is not null)) then raise exception 'CRM_INVALID_AMBASSADOR' using errcode='22023';end if;
 select * into o from public.crm_opportunities where company_id=p_company and id=p_opportunity;
 if not found then raise exception 'CRM_INVALID_CARD' using errcode='22023';end if;
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

create function crm_private.amb_close_campaign(p_company uuid,p_campaign uuid,p_expected_version bigint,p_request_id uuid,p_confirm_pending boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;
begin
 perform crm_private.core_require_manager(p_company);
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

create function crm_private.amb_record_campaign_payment(p_company uuid,p_campaign uuid,p_ambassador uuid,p_expected_amount_cents bigint,p_request_id uuid,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_ambassador_campaigns;totals record;previous public.crm_campaign_payments;result public.crm_campaign_payments;hash text;
begin
 perform crm_private.core_require_manager(p_company);
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

create function crm_private.amb_adjust_referral(p_company uuid,p_referral uuid,p_expected_version bigint,p_refunded_cents integer,p_cancelled boolean,p_reason text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.crm_ambassador_referrals;camp uuid;previous public.crm_referral_revisions;hash text;
begin
 perform crm_private.core_require_manager(p_company);
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
revoke all on function crm_private.amb_save_referral(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function crm_private.amb_save_referral(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,bigint) to authenticated;
create function public.crm_save_referral(p_company uuid,p_referral uuid,p_campaign uuid,p_ambassador uuid,p_opportunity uuid,p_values jsonb,p_request_id uuid,p_expected_version bigint default null) returns jsonb language sql security invoker set search_path='' as $$select crm_private.amb_save_referral(p_company,p_referral,p_campaign,p_ambassador,p_opportunity,p_values,p_request_id,p_expected_version);$$;
revoke all on function public.crm_save_referral(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_referral(uuid,uuid,uuid,uuid,uuid,jsonb,uuid,bigint) to authenticated;
revoke all on function crm_private.amb_close_campaign(uuid,uuid,bigint,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function crm_private.amb_close_campaign(uuid,uuid,bigint,uuid,boolean) to authenticated;
create function public.crm_close_campaign(p_company uuid,p_campaign uuid,p_expected_version bigint,p_request_id uuid,p_confirm_pending boolean default false) returns jsonb language sql security invoker set search_path='' as $$select crm_private.amb_close_campaign(p_company,p_campaign,p_expected_version,p_request_id,p_confirm_pending);$$;
revoke all on function public.crm_close_campaign(uuid,uuid,bigint,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.crm_close_campaign(uuid,uuid,bigint,uuid,boolean) to authenticated;
revoke all on function crm_private.amb_record_campaign_payment(uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.amb_record_campaign_payment(uuid,uuid,uuid,bigint,uuid,text) to authenticated;
create function public.crm_record_campaign_payment(p_company uuid,p_campaign uuid,p_ambassador uuid,p_expected_amount_cents bigint,p_request_id uuid,p_note text default '') returns jsonb language sql security invoker set search_path='' as $$select crm_private.amb_record_campaign_payment(p_company,p_campaign,p_ambassador,p_expected_amount_cents,p_request_id,p_note);$$;
revoke all on function public.crm_record_campaign_payment(uuid,uuid,uuid,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_record_campaign_payment(uuid,uuid,uuid,bigint,uuid,text) to authenticated;
revoke all on function crm_private.amb_adjust_referral(uuid,uuid,bigint,integer,boolean,text,uuid) from public,anon,authenticated,service_role;
grant execute on function crm_private.amb_adjust_referral(uuid,uuid,bigint,integer,boolean,text,uuid) to authenticated;
create function public.crm_adjust_referral(p_company uuid,p_referral uuid,p_expected_version bigint,p_refunded_cents integer,p_cancelled boolean,p_reason text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select crm_private.amb_adjust_referral(p_company,p_referral,p_expected_version,p_refunded_cents,p_cancelled,p_reason,p_request_id);$$;
revoke all on function public.crm_adjust_referral(uuid,uuid,bigint,integer,boolean,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_adjust_referral(uuid,uuid,bigint,integer,boolean,text,uuid) to authenticated;

-- O contato de uma indicação não pode ser trocado enquanto o vínculo comercial a referencia.
create function crm_private.amb_guard_relinked_card() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.contact_id is distinct from old.contact_id and exists(select 1 from public.crm_ambassador_referrals where company_id=old.company_id and opportunity_id=old.id) then raise exception 'CRM_CARD_HAS_REFERRAL' using errcode='23514';end if;return new;
end;$$;
revoke all on function crm_private.amb_guard_relinked_card() from public,anon,authenticated,service_role;
create trigger ambassador_referral_card_guard before update on public.crm_opportunities for each row execute function crm_private.amb_guard_relinked_card();
commit;
