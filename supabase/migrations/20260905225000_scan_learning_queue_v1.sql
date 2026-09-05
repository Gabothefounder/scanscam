create or replace view public.scan_learning_queue_v1
with (security_invoker = true)
as
select
  s.id as scan_id,
  s.created_at,
  s.risk_tier,
  s.language,
  nullif(s.intel_features->>'analysis_model','') as analysis_model,
  nullif(s.intel_features->>'analysis_path','') as analysis_path,
  nullif(s.intel_features->>'context_quality','') as context_quality,
  nullif(s.intel_features->>'submission_route','') as submission_route,
  nullif(s.intel_features->>'narrative_family','') as final_family,
  nullif(s.intel_features->>'requested_action','') as final_requested_action,
  nullif(s.intel_features->'semantic_v1'->>'scam_family','') as semantic_family,
  nullif(s.intel_features->'semantic_v1'->>'attack_stage','') as semantic_attack_stage,
  nullif(s.intel_features->'semantic_v1'->>'context_sufficiency','') as semantic_context_sufficiency,
  case
    when jsonb_typeof(s.intel_features->'semantic_v1'->'confidence') = 'number'
    then (s.intel_features->'semantic_v1'->>'confidence')::numeric
  end as semantic_confidence,
  coalesce((s.intel_features->'disagreement_v1'->>'count')::int, 0) as disagreement_count,
  coalesce((s.intel_features->'disagreement_v1'->>'score')::numeric, 0) as disagreement_score,
  coalesce(s.intel_features->'disagreement_v1'->'items', '[]'::jsonb) as disagreement_items,
  coalesce((s.intel_features->>'ai_parse_fallback')::boolean, false) as ai_parse_fallback,
  coalesce((s.intel_features->>'context_refined')::boolean, false) as context_refined,
  nullif(s.intel_features->>'refinement_parent_scan_id','') as refinement_parent_scan_id,
  nullif(s.intel_features->'pattern_signature_v1'->>'signature','') as pattern_signature,
  (
    coalesce((s.intel_features->'disagreement_v1'->>'score')::numeric, 0) * 50
    + case when coalesce((s.intel_features->>'ai_parse_fallback')::boolean, false) then 30 else 0 end
    + case when s.intel_features->>'context_quality' in ('thin','fragment','unknown') then 10 else 0 end
    + case when s.intel_features->>'narrative_family' in ('unknown','none','') then 5 else 0 end
  )::numeric as learning_priority
from public.scans s
where
  nullif(s.intel_features->'disagreement_v1'->>'score','') is not null
  or coalesce((s.intel_features->>'ai_parse_fallback')::boolean, false)
  or coalesce((s.intel_features->>'context_refined')::boolean, false);

revoke all on public.scan_learning_queue_v1 from anon, authenticated;
grant select on public.scan_learning_queue_v1 to service_role;
