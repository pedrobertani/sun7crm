-- Fixed follow-up policy approved on 25/10/2026: 24 hours, 3 days, 7 days.
-- Cards, history, notifications and stage customization keep their existing IDs.
begin;

drop function public.crm_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint);
drop function crm_private.core_configure_card_alerts(uuid,uuid,uuid,integer,integer,integer,boolean,bigint);

-- Keep the report contract and invoker permissions; thresholds are now constants.
create or replace view public.crm_card_activity with(security_invoker=true) as
with activity as (
 select o.company_id,o.id as opportunity_id,o.contact_id,o.board_id,o.stage_id,o.title,o.value_cents,o.created_at,o.follow_up_at,o.is_closed,
 c.name as contact_name,c.phone,c.owner_membership_id,coalesce(p.display_name,'Sem responsável') as owner_name,b.name as board_name,s.name as stage_name,
 true as alerts_enabled,24 as first_response_hours,3 as idle_days_threshold,7 as escalation_days_threshold,
 min(h.occurred_at) as first_activity_at,max(h.occurred_at) as last_activity_at
 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
 join public.crm_boards b on b.company_id=o.company_id and b.id=o.board_id
 join public.crm_stages s on s.company_id=o.company_id and s.board_id=o.board_id and s.id=o.stage_id
 left join public.crm_memberships m on m.company_id=c.company_id and m.id=c.owner_membership_id
 left join public.crm_profiles p on p.id=m.user_id
 left join public.crm_contact_history h on h.company_id=o.company_id and h.opportunity_id=o.id and h.kind in ('note','whatsapp_opened','card_moved')
 group by o.company_id,o.id,c.id,c.name,c.phone,c.owner_membership_id,p.display_name,b.id,b.name,s.id,s.name
), effective as (
 select *,greatest(coalesce(last_activity_at,created_at),follow_up_at) as effective_since from activity
)
select *,greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/3600))::integer as hours_without_activity,
 greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/86400))::integer as days_without_activity,
 extract(epoch from effective_since)::text as activity_key
from effective;

alter table public.crm_boards
 drop column alerts_enabled,
 drop column first_response_hours,
 drop column idle_days,
 drop column escalation_days;
alter table public.crm_stages
 drop column alerts_enabled,
 drop column first_response_hours,
 drop column idle_days,
 drop column escalation_days;

comment on view public.crm_card_activity is
 'Fixed follow-up alerts: 24h without first activity, 3 days for the owner, 7 days for management. Company and portfolio RLS apply.';

commit;
