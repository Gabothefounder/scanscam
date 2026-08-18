-- Additive v2 system-analysis layer for internal radar.
-- Keeps existing v1 radar views/routes unchanged.

create or replace view public.intel_v2_clean_scans as
with base as (
  select
    s.id,
    s.created_at,
    date_trunc('week', s.created_at at time zone 'utc')::date as week_start,
    s.risk_tier,
    s.summary_sentence,
    s.country_code,
    s.region_code,
    s.city,
    case
      -- Prefer scanner-provided input_type when present and concrete.
      when nullif(lower(trim(coalesce(s.intel_features->>'input_type', ''))), '') is not null
        and lower(trim(coalesce(s.intel_features->>'input_type', ''))) <> 'unknown'
        then lower(trim(s.intel_features->>'input_type'))
      -- Fallback inference for older scans without explicit input_type.
      when lower(coalesce(s.intel_features->>'link_present', 'false')) = 'true'
        and coalesce(s.intel_features->>'context_quality', 'unknown') in ('fragment', 'thin')
        then 'link_only'
      when lower(coalesce(s.intel_features->>'callback_number_present', 'false')) = 'true'
        and lower(coalesce(s.intel_features->>'link_present', 'false')) <> 'true'
        then 'phone_only'
      when coalesce(s.intel_features->>'context_quality', 'unknown') in ('fragment', 'unknown')
        then 'fragment'
      when coalesce(s.intel_features->>'context_quality', 'unknown') in ('thin', 'partial', 'full')
        then 'full_message'
      else 'unknown'
    end as input_type,
    coalesce(s.intel_features->>'narrative_category', 'unknown') as narrative_category,
    coalesce(s.intel_features->>'narrative_family', 'unknown') as narrative_family,
    coalesce(s.intel_features->>'authority_type', 'unknown') as authority_type,
    coalesce(s.intel_features->>'channel_type', 'unknown') as channel_type,
    coalesce(s.intel_features->>'payment_intent', 'unknown') as payment_intent,
    coalesce(s.intel_features->>'requested_action', 'unknown') as requested_action,
    coalesce(s.intel_features->>'context_quality', 'unknown') as context_quality,
    coalesce(s.intel_features->>'intel_state', 'unknown') as intel_state,
    coalesce((s.intel_features->'link_artifact'->>'root_domain'), null) as root_domain,
    coalesce((s.intel_features->'link_artifact'->>'domain'), null) as domain,
    coalesce((s.intel_features->'link_artifact'->>'tld'), null) as tld,
    case
      when lower(coalesce(s.intel_features->'link_artifact'->>'is_shortened', 'false')) = 'true' then true
      else false
    end as is_shortened,
    case
      when lower(coalesce(s.intel_features->'link_artifact'->>'has_suspicious_tld', 'false')) = 'true' then true
      else false
    end as has_suspicious_tld,
    case
      when lower(coalesce(s.intel_features->>'link_present', 'false')) = 'true' then true
      else false
    end as link_present,
    case
      when lower(coalesce(s.intel_features->>'callback_number_present', 'false')) = 'true' then true
      else false
    end as callback_number_present,
    coalesce(s.used_fallback, false) as used_fallback
  from public.scans s
)
select
  b.*,
  (
    b.input_type = 'full_message'
    and b.context_quality in ('partial', 'full')
    and b.intel_state <> 'insufficient_context'
  ) as is_valid_input,
  -- Broader operator-learning lens; includes artifact inputs and thin cases.
  (
    b.input_type in ('full_message', 'link_only', 'phone_only')
    and b.input_type <> 'fragment'
  ) as is_learning_input,
  (b.input_type in ('link_only', 'phone_only')) as is_artifact_input,
  (
    (case when b.narrative_category not in ('unknown', 'none') then 1 else 0 end) +
    (case when b.authority_type not in ('unknown', 'none') then 1 else 0 end) +
    (case when b.channel_type not in ('unknown', 'none') then 1 else 0 end) +
    (case when b.payment_intent not in ('unknown', 'none') then 1 else 0 end)
  ) as core_signal_count,
  (b.risk_tier in ('medium', 'high')) as is_high_signal
from base b;

create or replace view public.intel_v2_recent_scams as
select
  c.created_at,
  c.risk_tier,
  c.summary_sentence,
  c.narrative_category,
  c.narrative_family,
  c.authority_type,
  c.payment_intent,
  c.input_type,
  c.root_domain,
  c.city,
  c.region_code,
  c.core_signal_count,
  c.context_quality,
  c.intel_state
from public.intel_v2_clean_scans c
order by c.created_at desc
limit 50;

create or replace view public.intel_v2_behavioral as
with dim_rows as (
  select week_start, 'narrative_category'::text as dimension, narrative_category as value
  from public.intel_v2_clean_scans
  union all
  select week_start, 'channel_type'::text as dimension, channel_type as value
  from public.intel_v2_clean_scans
  union all
  select week_start, 'payment_intent'::text as dimension, payment_intent as value
  from public.intel_v2_clean_scans
  union all
  select week_start, 'authority_type'::text as dimension, authority_type as value
  from public.intel_v2_clean_scans
),
agg as (
  select
    d.week_start,
    d.dimension,
    coalesce(d.value, 'unknown') as value,
    count(*)::bigint as scan_count
  from dim_rows d
  group by d.week_start, d.dimension, coalesce(d.value, 'unknown')
)
select
  a.week_start,
  a.dimension,
  a.value,
  a.scan_count,
  (a.scan_count::numeric / nullif(sum(a.scan_count) over (partition by a.week_start, a.dimension), 0)::numeric) as share_of_week
from agg a;

create or replace view public.intel_v2_patterns as
with b as (
  select
    week_start,
    dimension,
    value,
    scan_count::bigint as this_week_count,
    share_of_week::numeric as this_week_share,
    lag(scan_count::bigint) over (partition by dimension, value order by week_start) as last_week_count,
    lag(share_of_week::numeric) over (partition by dimension, value order by week_start) as last_week_share
  from public.intel_v2_behavioral
),
d as (
  select
    week_start,
    dimension,
    value,
    this_week_count,
    this_week_share,
    coalesce(last_week_count, 0)::bigint as last_week_count,
    coalesce(last_week_share, 0)::numeric as last_week_share,
    (this_week_count - coalesce(last_week_count, 0))::bigint as count_delta_wow,
    (this_week_share - coalesce(last_week_share, 0))::numeric as share_delta_wow
  from b
)
select
  d.*,
  dense_rank() over (
    partition by d.week_start
    order by d.share_delta_wow desc, d.this_week_count desc, d.dimension, d.value
  ) as emerging_rank,
  (d.this_week_count >= 3 and d.share_delta_wow > 0.05) as is_meaningful
from d;

create or replace view public.intel_v2_system_quality as
with scope as (
  select *
  from public.intel_v2_clean_scans
  where created_at >= (now() - interval '7 days')
),
agg as (
  select
    min(created_at)::date as window_start,
    count(*)::bigint as scan_count,
    avg(case when is_valid_input then 1.0 else 0.0 end) * 100.0 as valid_input_pct,
    avg(case when is_learning_input then 1.0 else 0.0 end) * 100.0 as learning_input_pct,
    avg(
      case
        when context_quality in ('partial', 'full') and intel_state <> 'insufficient_context' then 1.0
        else 0.0
      end
    ) * 100.0 as context_sufficient_pct,
    avg(case when input_type = 'full_message' then 1.0 else 0.0 end) * 100.0 as full_message_pct,
    avg(case when input_type = 'link_only' then 1.0 else 0.0 end) * 100.0 as link_only_pct,
    avg(case when input_type = 'fragment' then 1.0 else 0.0 end) * 100.0 as fragment_pct,
    avg(case when input_type = 'phone_only' then 1.0 else 0.0 end) * 100.0 as phone_only_pct,
    avg(case when is_valid_input and narrative_category not in ('unknown', 'none') then 1.0 else 0.0 end) * 100.0 as narrative_known_pct_on_valid_inputs,
    avg(case when is_valid_input and authority_type not in ('unknown', 'none') then 1.0 else 0.0 end) * 100.0 as authority_known_pct_on_valid_inputs,
    avg(case when is_valid_input and payment_intent not in ('unknown', 'none') then 1.0 else 0.0 end) * 100.0 as payment_known_pct_on_valid_inputs,
    avg(case when link_present and is_shortened then 1.0 else 0.0 end) * 100.0 as shortened_link_pct,
    avg(case when link_present and has_suspicious_tld then 1.0 else 0.0 end) * 100.0 as suspicious_tld_pct,
    avg(case when is_valid_input then core_signal_count::numeric end) as avg_core_signal_count_on_valid_inputs,
    avg(case when risk_tier in ('medium', 'high') then 1.0 else 0.0 end) * 100.0 as medium_high_pct,
    avg(case when used_fallback then 1.0 else 0.0 end) * 100.0 as fallback_rate_pct
  from scope
)
select
  a.*,
  null::text as recommended_upgrade_hint
from agg a;

create or replace view public.intel_v2_improvement_insights as
with s as (
  select *
  from public.intel_v2_system_quality
),
g as (
  select
    s.window_start,
    greatest(
      100.0 - coalesce(s.narrative_known_pct_on_valid_inputs, 0),
      100.0 - coalesce(s.authority_known_pct_on_valid_inputs, 0),
      100.0 - coalesce(s.payment_known_pct_on_valid_inputs, 0)
    ) as dominant_gap_pct,
    case
      when (100.0 - coalesce(s.narrative_known_pct_on_valid_inputs, 0)) >= (100.0 - coalesce(s.authority_known_pct_on_valid_inputs, 0))
       and (100.0 - coalesce(s.narrative_known_pct_on_valid_inputs, 0)) >= (100.0 - coalesce(s.payment_known_pct_on_valid_inputs, 0))
        then 'narrative_completion_gap'
      when (100.0 - coalesce(s.authority_known_pct_on_valid_inputs, 0)) >= (100.0 - coalesce(s.payment_known_pct_on_valid_inputs, 0))
        then 'authority_completion_gap'
      else 'payment_completion_gap'
    end as dominant_gap,
    s.link_only_pct,
    s.narrative_known_pct_on_valid_inputs,
    s.authority_known_pct_on_valid_inputs,
    s.payment_known_pct_on_valid_inputs
  from s
)
select
  g.window_start,
  g.dominant_gap,
  g.dominant_gap_pct,
  g.link_only_pct,
  g.narrative_known_pct_on_valid_inputs,
  g.authority_known_pct_on_valid_inputs,
  g.payment_known_pct_on_valid_inputs
from g;
