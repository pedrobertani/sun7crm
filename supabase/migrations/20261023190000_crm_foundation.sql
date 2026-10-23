-- SUN7CRM: fundação inicial. Aplicar UMA VEZ em projeto Supabase de desenvolvimento.
-- Não cria usuários, senhas, empresas de exemplo ou credenciais.
-- Não altera tabelas existentes de outros projetos. Não conecta a demo ao banco.
begin;

do $$
begin
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Este script precisa do Supabase Auth (auth.users e auth.uid).';
  end if;
end;
$$;

create schema crm_private;
revoke all on schema crm_private from public, anon, authenticated;
grant usage on schema crm_private to authenticated;

create table public.crm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Administradores são cadastrados somente por operador confiável via SQL.
create table crm_private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table crm_private.platform_admins enable row level security;
revoke all on crm_private.platform_admins from public, anon, authenticated, service_role;

create table public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  display_name text check (length(btrim(display_name)) between 1 and 160),
  segment text not null check (length(btrim(segment)) between 1 and 160),
  template text not null default 'aesthetic' check (template in ('aesthetic', 'generic')),
  theme text not null default 'sun7'
    check (theme in ('sun7', 'blue', 'original', 'neutral', 'elegant', 'rose', 'barber')),
  logo_path text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cobrança não é exposta à equipe da empresa. Não há sistema de planos.
create table public.crm_company_billing (
  company_id uuid primary key references public.crm_companies(id) on delete restrict,
  monthly_amount_cents integer not null check (monthly_amount_cents >= 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  user_id uuid not null references public.crm_profiles(id) on delete restrict,
  role text not null check (role in ('manager', 'seller', 'reception')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id),
  unique (company_id, id)
);
create index crm_memberships_user_active_idx on public.crm_memberships(user_id, company_id)
  where active;

-- Publicação final de documentos é uma etapa posterior: nenhum rascunho é ativado aqui.
create table public.crm_legal_documents (
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null check (length(btrim(version)) between 1 and 80),
  body text not null check (length(btrim(body)) > 0),
  content_sha256 text not null check (length(content_sha256) = 64),
  published_at timestamptz not null default now(),
  primary key (kind, version)
);
create table public.crm_legal_requirements (
  kind text primary key check (kind in ('terms', 'privacy')),
  version text not null,
  foreign key (kind, version) references public.crm_legal_documents(kind, version)
);
create table public.crm_legal_acceptances (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  kind text not null,
  version text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  primary key (user_id, kind, version),
  foreign key (kind, version) references public.crm_legal_documents(kind, version)
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  owner_membership_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  phone text not null default '' check (length(phone) <= 40),
  email text not null default '' check (length(email) <= 254),
  temperature text not null default 'unclassified'
    check (temperature in ('unclassified', 'cold', 'warm', 'hot')),
  interests text not null default '' check (length(interests) <= 4000),
  notes text not null default '' check (length(notes) <= 10000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, owner_membership_id)
    references public.crm_memberships(company_id, id) on delete restrict
);
create index crm_contacts_company_owner_idx on public.crm_contacts(company_id, owner_membership_id);
create index crm_contacts_company_created_idx on public.crm_contacts(company_id, created_at);

create table public.crm_boards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  kind text not null check (kind in ('leads', 'clients')),
  name text not null check (length(btrim(name)) between 1 and 100),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);
create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  board_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, board_id, id),
  unique (board_id, position) deferrable initially immediate,
  foreign key (company_id, board_id)
    references public.crm_boards(company_id, id) on delete restrict
);
create index crm_stages_company_board_idx on public.crm_stages(company_id, board_id);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  contact_id uuid not null,
  board_id uuid not null,
  stage_id uuid not null,
  value_cents integer not null default 0 check (value_cents >= 0),
  source text not null default '' check (length(source) <= 160),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, contact_id)
    references public.crm_contacts(company_id, id) on delete restrict,
  foreign key (company_id, board_id, stage_id)
    references public.crm_stages(company_id, board_id, id) on delete restrict
);
create index crm_opportunities_company_stage_idx
  on public.crm_opportunities(company_id, board_id, stage_id);
create index crm_opportunities_contact_idx on public.crm_opportunities(company_id, contact_id);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  owner_membership_id uuid not null,
  contact_id uuid,
  title text not null check (length(btrim(title)) between 1 and 240),
  due_date date not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, owner_membership_id)
    references public.crm_memberships(company_id, id) on delete restrict,
  foreign key (company_id, contact_id)
    references public.crm_contacts(company_id, id) on delete restrict,
  check ((status = 'done') = (completed_at is not null))
);
create index crm_tasks_company_owner_due_idx
  on public.crm_tasks(company_id, owner_membership_id, due_date);

-- Auditoria mínima: identificadores e ação, sem cópia de contatos, senhas ou tokens.
create table public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  actor_user_id uuid,
  entity text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  occurred_at timestamptz not null default statement_timestamp()
);
create index crm_audit_company_time_idx on public.crm_audit_events(company_id, occurred_at);

-- Auxiliares fora dos schemas expostos pela Data API. Não expor crm_private.
create function crm_private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from crm_private.platform_admins a
    where a.user_id = (select auth.uid()) and a.active
  );
$$;
create function crm_private.company_role(target_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.crm_memberships m
  join public.crm_companies c on c.id = m.company_id
  where m.company_id = target_company and m.user_id = (select auth.uid())
    and m.active and c.enabled;
$$;
create function crm_private.has_current_acceptance() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and (select count(*) from public.crm_legal_requirements) = 2
    and not exists (
      select 1 from public.crm_legal_requirements r
      where not exists (
        select 1 from public.crm_legal_acceptances a
        where a.user_id = (select auth.uid()) and a.kind = r.kind and a.version = r.version
      )
    );
$$;
create function crm_private.has_company_access(target_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm_private.company_role(target_company) is not null
    and crm_private.has_current_acceptance();
$$;
create function crm_private.owns_membership(target_company uuid, target_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crm_memberships m
    where m.company_id = target_company and m.id = target_member
      and m.user_id = (select auth.uid()) and m.active
  );
$$;
create function crm_private.active_membership(target_company uuid, target_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crm_memberships m
    where m.company_id = target_company and m.id = target_member and m.active
  );
$$;
create function crm_private.can_read_contact(target_company uuid, target_contact uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crm_contacts c
    where c.company_id = target_company and c.id = target_contact
      and crm_private.has_company_access(c.company_id)
      and (crm_private.company_role(c.company_id) in ('manager', 'reception')
        or crm_private.owns_membership(c.company_id, c.owner_membership_id))
  );
$$;
create function crm_private.can_write_contact(target_company uuid, target_contact uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crm_contacts c
    where c.company_id = target_company and c.id = target_contact
      and crm_private.has_company_access(c.company_id)
      and (crm_private.company_role(c.company_id) = 'manager'
        or (crm_private.company_role(c.company_id) = 'seller'
          and crm_private.owns_membership(c.company_id, c.owner_membership_id)))
  );
$$;
create function crm_private.can_read_profile(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_user = (select auth.uid())
    or (crm_private.is_platform_admin() and crm_private.has_current_acceptance())
    or exists (
      select 1 from public.crm_memberships m
      where m.user_id = target_user and m.active
        and crm_private.has_company_access(m.company_id)
    );
$$;

-- Interface somente de leitura da própria condição administrativa para o futuro backend.
create function public.crm_is_platform_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select crm_private.is_platform_admin();
$$;
revoke all on function public.crm_is_platform_admin() from public, anon, authenticated;
grant execute on function public.crm_is_platform_admin() to authenticated;

create function crm_private.protect_identity_and_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (to_jsonb(new)->>'id') is distinct from (to_jsonb(old)->>'id')
    or (to_jsonb(new)->>'company_id') is distinct from (to_jsonb(old)->>'company_id')
    or (to_jsonb(new)->>'created_by') is distinct from (to_jsonb(old)->>'created_by')
    or new.created_at is distinct from old.created_at then
    raise exception 'Identidade, empresa e autoria do registro são imutáveis.' using errcode = '23514';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
create function crm_private.task_completion() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'done' then
    if tg_op = 'UPDATE' and old.status = 'done' then
      new.completed_at := old.completed_at;
    else
      new.completed_at := statement_timestamp();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create function crm_private.legal_document_hash() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Documento publicado é imutável; publique uma nova versão.' using errcode = '23514';
  end if;
  new.content_sha256 := encode(sha256(convert_to(new.body, 'UTF8')), 'hex');
  return new;
end;
$$;
create trigger crm_legal_documents_immutable
before insert or update or delete on public.crm_legal_documents
for each row execute function crm_private.legal_document_hash();

create function crm_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  tenant uuid;
  entity_id uuid;
begin
  if tg_op = 'DELETE' then item := to_jsonb(old); else item := to_jsonb(new); end if;
  if tg_table_name = 'crm_companies' then
    tenant := (item->>'id')::uuid;
  else
    tenant := (item->>'company_id')::uuid;
  end if;
  entity_id := coalesce((item->>'id')::uuid, tenant);
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (tenant, (select auth.uid()), tg_table_name, entity_id, tg_op);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare item text;
begin
  foreach item in array array[
    'crm_profiles', 'crm_companies', 'crm_company_billing', 'crm_memberships',
    'crm_contacts', 'crm_boards', 'crm_stages', 'crm_opportunities', 'crm_tasks'
  ] loop
    execute format('create trigger protect_identity before update on public.%I for each row execute function crm_private.protect_identity_and_touch()', item);
  end loop;
  foreach item in array array[
    'crm_companies', 'crm_company_billing', 'crm_memberships', 'crm_contacts',
    'crm_boards', 'crm_stages', 'crm_opportunities', 'crm_tasks'
  ] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function crm_private.audit_change()', item);
  end loop;
end;
$$;
create trigger task_completion before insert or update on public.crm_tasks
for each row execute function crm_private.task_completion();

-- Revogar os grants automáticos do Supabase antes de conceder o mínimo necessário.
do $$
declare item text;
begin
  foreach item in array array[
    'crm_profiles', 'crm_companies', 'crm_company_billing', 'crm_memberships',
    'crm_legal_documents', 'crm_legal_requirements', 'crm_legal_acceptances',
    'crm_contacts', 'crm_boards', 'crm_stages', 'crm_opportunities', 'crm_tasks',
    'crm_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', item);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', item);
    execute format('grant select, insert, update, delete on public.%I to service_role', item);
    execute format('grant select on public.%I to authenticated', item);
  end loop;
end;
$$;

grant update (display_name) on public.crm_profiles to authenticated;
grant update (display_name, theme, logo_path) on public.crm_companies to authenticated;
grant insert (kind, version) on public.crm_legal_acceptances to authenticated;
grant insert (company_id, owner_membership_id, name, phone, email, temperature, interests, notes)
  on public.crm_contacts to authenticated;
grant update (owner_membership_id, name, phone, email, temperature, interests, notes)
  on public.crm_contacts to authenticated;
grant insert (company_id, contact_id, board_id, stage_id, value_cents, source)
  on public.crm_opportunities to authenticated;
grant update (stage_id, value_cents, source) on public.crm_opportunities to authenticated;
grant insert (company_id, owner_membership_id, contact_id, title, due_date, status)
  on public.crm_tasks to authenticated;
grant update (owner_membership_id, contact_id, title, due_date, status)
  on public.crm_tasks to authenticated;

-- Documento público é consultável por uma conta autenticada antes do aceite.
create policy legal_documents_read on public.crm_legal_documents
for select to authenticated using (true);
create policy legal_requirements_read on public.crm_legal_requirements
for select to authenticated using (true);
create policy legal_acceptances_read_self on public.crm_legal_acceptances
for select to authenticated using (user_id = (select auth.uid()));
create policy legal_acceptances_insert_self on public.crm_legal_acceptances
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.crm_legal_requirements r
    where r.kind = crm_legal_acceptances.kind and r.version = crm_legal_acceptances.version
  )
);

create policy profiles_read on public.crm_profiles
for select to authenticated using (crm_private.can_read_profile(id));
create policy profiles_update_self on public.crm_profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy companies_read on public.crm_companies
for select to authenticated using (
  crm_private.has_company_access(id)
  or (crm_private.is_platform_admin() and crm_private.has_current_acceptance())
);
create policy companies_update_brand on public.crm_companies
for update to authenticated using (
  crm_private.has_company_access(id) and crm_private.company_role(id) = 'manager'
) with check (
  crm_private.has_company_access(id) and crm_private.company_role(id) = 'manager'
);
create policy billing_read_admin on public.crm_company_billing
for select to authenticated using (
  crm_private.is_platform_admin() and crm_private.has_current_acceptance()
);
create policy memberships_read on public.crm_memberships
for select to authenticated using (
  crm_private.has_company_access(company_id)
  or (crm_private.is_platform_admin() and crm_private.has_current_acceptance())
);

create policy contacts_read on public.crm_contacts
for select to authenticated using (
  crm_private.has_company_access(company_id)
  and (crm_private.company_role(company_id) in ('manager', 'reception')
    or crm_private.owns_membership(company_id, owner_membership_id))
);
create policy contacts_insert on public.crm_contacts
for insert to authenticated with check (
  crm_private.has_company_access(company_id)
  and crm_private.active_membership(company_id, owner_membership_id)
  and (crm_private.company_role(company_id) = 'manager'
    or (crm_private.company_role(company_id) = 'seller'
      and crm_private.owns_membership(company_id, owner_membership_id)))
);
create policy contacts_update on public.crm_contacts
for update to authenticated using (
  crm_private.has_company_access(company_id)
  and (crm_private.company_role(company_id) = 'manager'
    or (crm_private.company_role(company_id) = 'seller'
      and crm_private.owns_membership(company_id, owner_membership_id)))
) with check (
  crm_private.has_company_access(company_id)
  and crm_private.active_membership(company_id, owner_membership_id)
  and (crm_private.company_role(company_id) = 'manager'
    or (crm_private.company_role(company_id) = 'seller'
      and crm_private.owns_membership(company_id, owner_membership_id)))
);

create policy boards_read on public.crm_boards
for select to authenticated using (crm_private.has_company_access(company_id));
create policy stages_read on public.crm_stages
for select to authenticated using (crm_private.has_company_access(company_id));
create policy opportunities_read on public.crm_opportunities
for select to authenticated using (crm_private.can_read_contact(company_id, contact_id));
create policy opportunities_insert on public.crm_opportunities
for insert to authenticated with check (crm_private.can_write_contact(company_id, contact_id));
create policy opportunities_update on public.crm_opportunities
for update to authenticated using (crm_private.can_write_contact(company_id, contact_id))
with check (crm_private.can_write_contact(company_id, contact_id));

create policy tasks_read on public.crm_tasks
for select to authenticated using (
  crm_private.has_company_access(company_id)
  and (crm_private.company_role(company_id) = 'manager'
    or crm_private.owns_membership(company_id, owner_membership_id))
);
create policy tasks_insert on public.crm_tasks
for insert to authenticated with check (
  crm_private.has_company_access(company_id)
  and crm_private.active_membership(company_id, owner_membership_id)
  and (crm_private.company_role(company_id) = 'manager'
    or crm_private.owns_membership(company_id, owner_membership_id))
  and (contact_id is null or crm_private.can_read_contact(company_id, contact_id))
);
create policy tasks_update on public.crm_tasks
for update to authenticated using (
  crm_private.has_company_access(company_id)
  and (crm_private.company_role(company_id) = 'manager'
    or crm_private.owns_membership(company_id, owner_membership_id))
) with check (
  crm_private.has_company_access(company_id)
  and crm_private.active_membership(company_id, owner_membership_id)
  and (crm_private.company_role(company_id) = 'manager'
    or crm_private.owns_membership(company_id, owner_membership_id))
  and (contact_id is null or crm_private.can_read_contact(company_id, contact_id))
);
create policy audit_read on public.crm_audit_events
for select to authenticated using (
  (crm_private.is_platform_admin() and crm_private.has_current_acceptance())
  or (crm_private.has_company_access(company_id) and crm_private.company_role(company_id) = 'manager')
);

-- Os auxiliares são chamados pelas políticas; gatilhos não precisam de EXECUTE público.
do $$
declare item record;
begin
  for item in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'crm_private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', item.signature);
  end loop;
end;
$$;
grant execute on function crm_private.is_platform_admin() to authenticated;
grant execute on function crm_private.company_role(uuid) to authenticated;
grant execute on function crm_private.has_current_acceptance() to authenticated;
grant execute on function crm_private.has_company_access(uuid) to authenticated;
grant execute on function crm_private.owns_membership(uuid, uuid) to authenticated;
grant execute on function crm_private.active_membership(uuid, uuid) to authenticated;
grant execute on function crm_private.can_read_contact(uuid, uuid) to authenticated;
grant execute on function crm_private.can_write_contact(uuid, uuid) to authenticated;
grant execute on function crm_private.can_read_profile(uuid) to authenticated;

comment on schema crm_private is 'SUN7CRM: uso interno; manter fora dos schemas expostos na Data API.';
comment on table public.crm_company_billing is 'Valor e vencimento definidos por empresa; não representa recebimentos.';
comment on table public.crm_legal_acceptances is 'Aceite de contas reais autenticadas. A demo não grava nesta tabela.';
comment on table public.crm_boards is 'Edição estrutural exige comando transacional no backend, ainda não implementado.';
commit;
