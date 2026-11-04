-- Projeção de funil por contatos iniciais e percentuais definidos pelo gestor.
-- O primeiro estágio contém start_contacts; não armazena resultados ou vendas.
-- Compatível com funil reverso, modo manual e regras de premiação já existentes.
begin;
create or replace function crm_private.validate_goal_plan() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s jsonb; m jsonb; n integer:=0; t text; rate numeric; manual boolean:=false; from_contacts boolean:=false; stage_count numeric; previous_count numeric;
begin
  if jsonb_typeof(new.stages)<>'array' or jsonb_array_length(new.stages) not between 2 and 8
    or jsonb_typeof(new.medals)<>'array' or jsonb_array_length(new.medals)>8
  then raise exception 'CRM_INVALID_GOAL_CONFIGURATION' using errcode='23514'; end if;
  for s in select value from jsonb_array_elements(new.stages) loop
    t:=btrim(s->>'label');
    if jsonb_typeof(s)<>'object' or t is null or char_length(t) not between 1 and 50
      or exists(select 1 from jsonb_object_keys(s) k where k not in ('label','rate','count','start_contacts')) then
      raise exception 'CRM_INVALID_GOAL_STAGE' using errcode='23514';
    end if;
    if s ? 'count' then
      manual:=true;
      if jsonb_typeof(s->'count') is distinct from 'number'
        or (s->>'count')::numeric <> trunc((s->>'count')::numeric)
        or (s->>'count')::numeric not between 1 and 1000000000
      then raise exception 'CRM_INVALID_GOAL_STAGE_COUNT' using errcode='23514';end if;
    end if;
    if n=0 then
      if s ? 'start_contacts' then
        from_contacts:=true;
        if jsonb_typeof(s->'start_contacts') is distinct from 'number'
          or (s->>'start_contacts')::numeric <> trunc((s->>'start_contacts')::numeric)
          or (s->>'start_contacts')::numeric not between 1 and 1000000000
        then raise exception 'CRM_INVALID_START_CONTACTS' using errcode='23514';end if;
      end if;
      if s->'rate' is distinct from 'null'::jsonb and s ? 'rate'
      then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514'; end if;
    else
      if s ? 'start_contacts' then
        raise exception 'CRM_INVALID_START_CONTACTS' using errcode='23514';
      end if;
      if jsonb_typeof(s->'rate')<>'number' then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514'; end if;
      rate:=(s->>'rate')::numeric;
      if rate<=0 or rate>100 then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514';end if;
    end if;
    n:=n+1;
  end loop;
  if manual and from_contacts then
    raise exception 'CRM_GOAL_MODE_CONFLICT' using errcode='23514';
  end if;
  if manual then
    previous_count:=null;
    for s in select value from jsonb_array_elements(new.stages) loop
      if not (s ? 'count') then
        raise exception 'CRM_INVALID_GOAL_STAGE_COUNT' using errcode='23514';
      end if;
      stage_count:=(s->>'count')::numeric;
      if previous_count is not null and stage_count>previous_count then
        raise exception 'CRM_INVALID_GOAL_STAGE_ORDER' using errcode='23514';
      end if;
      previous_count:=stage_count;
    end loop;
  end if;
  if lower(new.stages->(n-1)->>'label') <> 'vendas' then
     raise exception 'CRM_LAST_GOAL_STAGE_SALES' using errcode='23514';
  end if;
  for m in select value from jsonb_array_elements(new.medals) loop
    if jsonb_typeof(m)<>'object' or nullif(btrim(m->>'label'),'') is null
      or char_length(m->>'label')>60
      or (m->>'kind') not in ('sales','percent')
      or (m ? 'icon' and ((m->>'icon') is null or (m->>'icon') not in ('bronze','silver','gold','trophy','diamond','crown','fire','star','rocket')))
      or jsonb_typeof(m->'threshold')<>'number'
      or (m->>'threshold')::numeric<>trunc((m->>'threshold')::numeric)
      or (m->>'threshold')::numeric not between 1 and 1000
      or exists(select 1 from jsonb_object_keys(m) k where k not in ('label','kind','threshold','icon','reward'))
    then raise exception 'CRM_INVALID_GOAL_MEDAL' using errcode='23514';end if;
    -- Prêmios são opcionais para preservar medalhas históricas.
    -- Valor financeiro é sempre em centavos; desbloqueio não significa pagamento.
    if m ? 'reward' then
      if jsonb_typeof(m->'reward') is distinct from 'object' then
        raise exception 'CRM_INVALID_GOAL_REWARD' using errcode='23514';
      end if;
      if m->'reward' ? 'description' and
        (jsonb_typeof(m->'reward'->'description') is distinct from 'string'
          or char_length(m->'reward'->>'description')>200) then
        raise exception 'CRM_INVALID_GOAL_REWARD' using errcode='23514';
      end if;
      if m->'reward'->>'kind' = 'money' then
        if jsonb_typeof(m->'reward'->'amount_cents') is distinct from 'number'
          or (m->'reward'->>'amount_cents')::numeric <> trunc((m->'reward'->>'amount_cents')::numeric)
          or (m->'reward'->>'amount_cents')::numeric not between 1 and 100000000
          or exists(select 1 from jsonb_object_keys(m->'reward') k where k not in ('kind','amount_cents','description'))
        then raise exception 'CRM_INVALID_GOAL_REWARD' using errcode='23514';end if;
      elsif m->'reward'->>'kind' = 'prize' then
        if jsonb_typeof(m->'reward'->'name') is distinct from 'string'
          or nullif(btrim(m->'reward'->>'name'),'') is null
          or char_length(m->'reward'->>'name')>100
          or exists(select 1 from jsonb_object_keys(m->'reward') k where k not in ('kind','name','description'))
        then raise exception 'CRM_INVALID_GOAL_REWARD' using errcode='23514';end if;
      else
        raise exception 'CRM_INVALID_GOAL_REWARD' using errcode='23514';
      end if;
    end if;
  end loop;
  new.updated_at:=now();
  return new;
end;$$;
commit;
