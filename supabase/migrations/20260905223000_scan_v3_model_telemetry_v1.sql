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
  coalesce(nullif(e.context->'props'->>'risk_tier',''), nullif(e.context->>'risk_tier','')) as risk_tier,
  coalesce(nullif(e.context->'props'->>'input_type',''), nullif(e.context->>'input_type','')) as input_type,
  nullif(e.context->'props'->>'intel_state','') as intel_state,
  coalesce(nullif(e.context->'props'->>'context_quality',''), nullif(e.context->>'context_quality','')) as context_quality,
  coalesce(nullif(e.context->'props'->>'analysis_mode',''), nullif(e.context->>'analysis_mode','')) as analysis_mode,
  nullif(e.context->'props'->>'current_family','') as current_family,
  nullif(e.context->'props'->>'channel','') as channel,
  nullif(e.context->'props'->>'primary_request','') as primary_request,
  nullif(e.context->'props'->>'lang','') as lang,
  nullif(e.context->'props'->>'error_code','') as error_code,
  case when jsonb_typeof(coalesce(e.context->'props'->'total_ms',e.context->'total_ms'))='number'
       then coalesce(e.context->'props'->>'total_ms',e.context->>'total_ms')::numeric end as total_ms,
  case when jsonb_typeof(coalesce(e.context->'props'->'ai_ms',e.context->'ai_ms'))='number'
       then coalesce(e.context->'props'->>'ai_ms',e.context->>'ai_ms')::numeric end as ai_ms,
  case when jsonb_typeof(coalesce(e.context->'props'->'ocr_ms',e.context->'ocr_ms'))='number'
       then coalesce(e.context->'props'->>'ocr_ms',e.context->>'ocr_ms')::numeric end as ocr_ms,
  case when jsonb_typeof(coalesce(e.context->'props'->'link_intel_ms',e.context->'link_intel_ms'))='number'
       then coalesce(e.context->'props'->>'link_intel_ms',e.context->>'link_intel_ms')::numeric end as link_intel_ms,
  case when jsonb_typeof(coalesce(e.context->'props'->'persist_ms',e.context->'persist_ms'))='number'
       then coalesce(e.context->'props'->>'persist_ms',e.context->>'persist_ms')::numeric end as persist_ms,
  coalesce(nullif(e.context->>'build_id',''), nullif(e.context->'props'->>'build_id','')) as build_id,
  coalesce(nullif(e.context->>'model',''), nullif(e.context->'props'->>'model','')) as model,
  coalesce(nullif(e.context->>'analysis_path',''), nullif(e.context->'props'->>'analysis_path','')) as analysis_path,
  case when jsonb_typeof(coalesce(e.context->'props'->'input_tokens',e.context->'input_tokens'))='number'
       then coalesce(e.context->'props'->>'input_tokens',e.context->>'input_tokens')::numeric end as input_tokens,
  case when jsonb_typeof(coalesce(e.context->'props'->'output_tokens',e.context->'output_tokens'))='number'
       then coalesce(e.context->'props'->>'output_tokens',e.context->>'output_tokens')::numeric end as output_tokens
from public.events e;

revoke all on public.product_events_v1 from anon, authenticated;
grant select on public.product_events_v1 to service_role;

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

create or replace view public.product_scan_model_daily_v1
with (security_invoker = true)
as
select
  created_at::date as day,
  coalesce(model,'unknown') as model,
  coalesce(analysis_path,'unknown') as analysis_path,
  count(*)::bigint as scans,
  round(avg(total_ms),0) as avg_total_ms,
  round(percentile_cont(0.5) within group (order by total_ms)::numeric,0) as p50_total_ms,
  round(percentile_cont(0.9) within group (order by total_ms)::numeric,0) as p90_total_ms,
  round(avg(ai_ms),0) as avg_ai_ms,
  round(avg(input_tokens),0) as avg_input_tokens,
  round(avg(output_tokens),0) as avg_output_tokens
from public.product_events_v1
where event_type='scan_stage_timing'
group by created_at::date, coalesce(model,'unknown'), coalesce(analysis_path,'unknown');

revoke all on public.product_scan_model_daily_v1 from anon, authenticated;
grant select on public.product_scan_model_daily_v1 to service_role;
