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
       then (e.context->'props'->>'persist_ms')::numeric end as persist_ms,
  coalesce(nullif(e.context->>'build_id',''), nullif(e.context->'props'->>'build_id','')) as build_id
from public.events e;

revoke all on public.product_events_v1 from anon, authenticated;
grant select on public.product_events_v1 to service_role;
