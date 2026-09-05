create or replace view public.scan_pattern_signatures_v1
with (security_invoker = true)
as
select
  s.intel_features->'pattern_signature_v1'->>'signature' as signature,
  max(s.intel_features->'pattern_signature_v1'->>'family') as family,
  max(s.intel_features->'pattern_signature_v1'->>'channel') as channel,
  max(s.intel_features->'pattern_signature_v1'->>'requested_action') as requested_action,
  max(s.intel_features->'pattern_signature_v1'->>'authority') as authority,
  max(s.intel_features->'pattern_signature_v1'->>'attack_stage') as attack_stage,
  count(*)::bigint as total_scans,
  count(*) filter (where s.created_at >= now() - interval '24 hours')::bigint as scans_24h,
  count(*) filter (where s.created_at >= now() - interval '7 days')::bigint as scans_7d,
  count(*) filter (where s.created_at >= now() - interval '30 days')::bigint as scans_30d,
  count(*) filter (
    where s.created_at >= now() - interval '8 days'
      and s.created_at < now() - interval '24 hours'
  )::bigint as scans_prior_7d,
  min(s.created_at) as first_seen,
  max(s.created_at) as last_seen,
  count(*) filter (where s.risk_tier = 'high')::bigint as high_risk_scans,
  round(
    (
      count(*) filter (where s.created_at >= now() - interval '24 hours')::numeric
      /
      greatest(
        (
          count(*) filter (
            where s.created_at >= now() - interval '8 days'
              and s.created_at < now() - interval '24 hours'
          )::numeric / 7.0
        ),
        0.25
      )
    ),
    2
  ) as velocity_vs_prior_daily
from public.scans s
where nullif(s.intel_features->'pattern_signature_v1'->>'signature','') is not null
group by s.intel_features->'pattern_signature_v1'->>'signature';

revoke all on public.scan_pattern_signatures_v1 from anon, authenticated;
grant select on public.scan_pattern_signatures_v1 to service_role;
