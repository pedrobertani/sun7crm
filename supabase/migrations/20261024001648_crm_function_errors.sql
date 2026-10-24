-- Erros técnicos: armazenamento somente pelo servidor; sem corpo de requisição.
begin;
create table crm_private.function_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default statement_timestamp(),
  function_name text not null check (function_name ~ '^crm-[a-z0-9-]{1,70}$'),
  request_id uuid not null,
  operation_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  execution_id uuid,
  http_status integer not null check (http_status between 400 and 599),
  error_code text not null check (error_code ~ '^[A-Z0-9_]{1,80}$'),
  safe_message text not null check (length(safe_message) between 1 and 500),
  exception_type text not null check (exception_type ~ '^[A-Za-z_][A-Za-z0-9_]{0,79}$'),
  trace text not null default '' check (length(trace)<=2048),
  unique (request_id,function_name,error_code)
);
alter table crm_private.function_errors enable row level security;
revoke all on crm_private.function_errors from public,anon,authenticated,service_role;
grant usage on schema crm_private to service_role;
grant insert on crm_private.function_errors to service_role;
-- ON CONFLICT precisa consultar somente as colunas da chave de deduplicação.
grant select (request_id,function_name,error_code) on crm_private.function_errors to service_role;
create policy function_errors_append_server on crm_private.function_errors
for insert to service_role with check (true);
create index crm_function_errors_time_idx on crm_private.function_errors(created_at desc);
create index crm_function_errors_actor_idx on crm_private.function_errors(actor_user_id) where actor_user_id is not null;

create function public.crm_log_function_error(p_event jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  insert into crm_private.function_errors(
    function_name,request_id,operation_id,actor_user_id,execution_id,http_status,
    error_code,safe_message,exception_type,trace
  ) values (
    p_event->>'function_name',(p_event->>'request_id')::uuid,
    nullif(p_event->>'operation_id','')::uuid,nullif(p_event->>'actor_user_id','')::uuid,
    nullif(p_event->>'execution_id','')::uuid,(p_event->>'http_status')::integer,
    p_event->>'error_code',p_event->>'safe_message',p_event->>'exception_type',
    coalesce(p_event->>'trace','')
  ) on conflict(request_id,function_name,error_code) do nothing;
end;
$$;
revoke all on function public.crm_log_function_error(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_log_function_error(jsonb) to service_role;
commit;
