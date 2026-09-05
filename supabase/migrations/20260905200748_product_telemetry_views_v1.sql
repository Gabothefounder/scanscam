create index if not exists events_created_at_idx
  on public.events (created_at desc);
create index if not exists events_event_type_created_at_idx
  on public.events (event_type, created_at desc);
create index if not exists events_session_id_idx
  on public.events ((context->>'session_id'))
  where context ? 'session_id';

create or replace view public.product_events_v1
with (security_invoker = true)
as
select
  e.id,
  e.created_at,
  e.event_type,
  e.severity,
  e.source,
  e.scan_id,
  nullif(e.context->>'session_id','') as session_id,
  nullif(e.context->>'route','') as route,
  nullif(e.context->'props'->>'flow','') as flow,
  nullif(e.context->'props'->>'step','') as step,
  nullif(e.context->'props'->>'surface','') as surface,
  nullif(e.context->'props'->>'intent','') as intent,
  nullif(e.context->'props'->>'target','') as target,
  nullif(e.context->'props'->>'stage','') as stage,
  nullif(e.context->'props'->>'action','') as action,
  nullif(e.context->'props'->>'entry_mode','') as entry_mode,
  nullif(e.context->'props'->>'result_source','') as result_source,
  nullif(e.context->'props'->>'risk_tier','') as risk_tier,
  nullif(e.context->'props'->>'input_type','') as input_type,
  nullif(e.context->'props'->>'intel_state','') as intel_state,
  nullif(e.context->'props'->>'context_quality','') as context_quality,
  nullif(e.context->'props'->>'analysis_mode','') as analysis_mode,
  nullif(e.context->'props'->>'current_family','') as current_family,
  nullif(e.context->'props'->>'channel','') as channel,
  nullif(e.context->'props'->>'primary_request','') as primary_request,
  nullif(e.context->'props'->>'lang','') as lang,
  nullif(e.context->'props'->>'error_code','') as error_code,
  case when jsonb_typeof(e.context->'props'->'total_ms')='number'
       then (e.context->'props'->>'total_ms')::numeric end as total_ms,
  case when jsonb_typeof(e.context->'props'->'ai_ms')='number'
       then (e.context->'props'->>'ai_ms')::numeric end as ai_ms,
  case when jsonb_typeof(e.context->'props'->'ocr_ms')='number'
       then (e.context->'props'->>'ocr_ms')::numeric end as ocr_ms,
  case when jsonb_typeof(e.context->'props'->'link_intel_ms')='number'
       then (e.context->'props'->>'link_intel_ms')::numeric end as link_intel_ms,
  case when jsonb_typeof(e.context->'props'->'persist_ms')='number'
       then (e.context->'props'->>'persist_ms')::numeric end as persist_ms
from public.events e;

revoke all on public.product_events_v1 from anon, authenticated;
grant select on public.product_events_v1 to service_role;

create or replace view public.product_funnel_daily_v1
with (security_invoker = true)
as
select
  created_at::date as day,
  event_type,
  count(*)::bigint as events,
  count(distinct session_id)::bigint as sessions,
  count(distinct scan_id)::bigint as scans
from public.product_events_v1
group by created_at::date, event_type;

revoke all on public.product_funnel_daily_v1 from anon, authenticated;
grant select on public.product_funnel_daily_v1 to service_role;

create or replace view public.product_intent_daily_v1
with (security_invoker = true)
as
select
  created_at::date as day,
  coalesce(surface,'unknown') as surface,
  coalesce(intent,'unknown') as intent,
  count(*)::bigint as events,
  count(distinct session_id)::bigint as sessions
from public.product_events_v1
where event_type in ('intent_selected','post_scan_action_selected')
group by created_at::date, coalesce(surface,'unknown'), coalesce(intent,'unknown');

revoke all on public.product_intent_daily_v1 from anon, authenticated;
grant select on public.product_intent_daily_v1 to service_role;

create or replace view public.product_scan_performance_daily_v1
with (security_invoker = true)
as
select
  created_at::date as day,
  count(*)::bigint as completed_scans,
  round(avg(total_ms),0) as avg_total_ms,
  round(percentile_cont(0.5) within group (order by total_ms)::numeric,0) as p50_total_ms,
  round(percentile_cont(0.9) within group (order by total_ms)::numeric,0) as p90_total_ms,
  round(avg(ai_ms),0) as avg_ai_ms,
  round(avg(link_intel_ms),0) as avg_link_intel_ms,
  round(avg(ocr_ms),0) as avg_ocr_ms,
  round(avg(persist_ms),0) as avg_persist_ms
from public.product_events_v1
where event_type='scan_stage_timing' and total_ms is not null
group by created_at::date;

revoke all on public.product_scan_performance_daily_v1 from anon, authenticated;
grant select on public.product_scan_performance_daily_v1 to service_role;

revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to service_role;
