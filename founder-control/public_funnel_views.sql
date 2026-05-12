-- ScanScam Founder Control Panel (public funnel only)
-- Analytics views only (create/replace view). No production app logic, no DDL on tables.
-- Timezone baseline: America/Montreal
-- v1.1.1: 3-view architecture (decision / diagnostic / legacy).
--   - ops_research_funnel_daily_v1   = decision-safe (standalone, no event telemetry)
--   - ops_event_health_daily_v1      = diagnostic counts only (no rates)
--   - ops_public_funnel_daily_clean_v1 = legacy (unchanged, synced to DATA_Public Funnel)
-- Unit-consistency rule: every rate uses same-unit numerator/denominator (scan/scan).
--   No session-unit rates. No mixed-unit rates.

create or replace view public.ops_public_funnel_daily_clean_v1 as
with allowed_events as (
  select unnest(array[
    'scan_submit_clicked',
    'scan_api_success',
    'scan_result_rendered',
    'context_refinement_shown',
    'context_refinement_submitted',
    'cta_shown',
    'cta_clicked',
    'pro_sales_viewed',
    'pro_unlock_clicked',
    'beta_unlock_started',
    'beta_unlock_completed',
    'payment_completed',
    'report_feedback_submitted'
  ]) as event_type
),
base as (
  select
    timezone('America/Montreal', e.created_at)::date as day_montreal,
    e.created_at,
    e.event_type,
    e.scan_id,
    nullif(trim(e.context->>'session_id'), '') as session_id,
    coalesce(e.context->>'route', '') as route
  from public.events e
  join allowed_events a on a.event_type = e.event_type
),
classified as (
  select
    b.*,
    (b.scan_id is not null and s.id is not null) as has_live_scan,
    (
      b.session_id = '94515dee-0533-435a-9744-31ce8ab8d6fc'
      or b.route ilike '/internal%'
      or b.route ilike '/msp/%'
      or b.route ilike '/partner/%'
    ) as is_internal_or_test
  from base b
  left join public.scans s on s.id = b.scan_id
),
raw_daily as (
  select
    day_montreal,
    count(*) as raw_event_rows,
    count(distinct session_id) filter (where session_id is not null) as raw_sessions,
    count(distinct scan_id) filter (where scan_id is not null) as raw_scan_ids
  from classified
  group by 1
),
clean_daily as (
  select
    day_montreal,
    count(*) filter (where not is_internal_or_test) as clean_event_rows,
    count(distinct session_id) filter (where not is_internal_or_test and session_id is not null) as clean_sessions,
    count(distinct scan_id) filter (where not is_internal_or_test and scan_id is not null) as clean_scan_ids,
    count(distinct scan_id) filter (where not is_internal_or_test and scan_id is not null and has_live_scan) as clean_live_scan_ids,

    count(distinct session_id) filter (
      where event_type = 'scan_submit_clicked'
        and session_id is not null
        and not is_internal_or_test
    ) as scan_submit_clicked_sessions,
    count(distinct session_id) filter (
      where event_type = 'scan_api_success'
        and session_id is not null
        and not is_internal_or_test
    ) as scan_api_success_sessions,
    count(distinct session_id) filter (
      where event_type = 'scan_result_rendered'
        and session_id is not null
        and not is_internal_or_test
    ) as scan_result_rendered_sessions,

    count(distinct scan_id) filter (
      where event_type = 'scan_api_success'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as scan_api_success_live_scans,
    count(distinct scan_id) filter (
      where event_type = 'scan_result_rendered'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as scan_result_rendered_live_scans,

    count(distinct scan_id) filter (
      where event_type = 'context_refinement_shown'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as context_refinement_shown_scans,
    count(distinct scan_id) filter (
      where event_type = 'context_refinement_submitted'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as context_refinement_submitted_scans,

    count(distinct scan_id) filter (
      where event_type = 'cta_shown'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as cta_shown_scans,
    count(distinct scan_id) filter (
      where event_type = 'cta_clicked'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as cta_clicked_scans,
    count(distinct scan_id) filter (
      where event_type = 'pro_sales_viewed'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as pro_sales_viewed_scans,
    count(distinct scan_id) filter (
      where event_type = 'pro_unlock_clicked'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as pro_unlock_clicked_scans,

    count(distinct scan_id) filter (
      where event_type = 'beta_unlock_started'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as beta_unlock_started_scans,
    count(distinct scan_id) filter (
      where event_type = 'beta_unlock_completed'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as beta_unlock_completed_scans,
    count(distinct scan_id) filter (
      where event_type = 'payment_completed'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as payment_completed_scans,
    count(distinct scan_id) filter (
      where event_type = 'report_feedback_submitted'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as report_feedback_submitted_scans
  from classified
  group by 1
)
select
  c.day_montreal,
  r.raw_event_rows,
  r.raw_sessions,
  r.raw_scan_ids,
  c.clean_event_rows,
  c.clean_sessions,
  c.clean_scan_ids,
  c.clean_live_scan_ids,
  c.scan_submit_clicked_sessions,
  c.scan_api_success_sessions,
  c.scan_result_rendered_sessions,
  c.scan_api_success_live_scans,
  c.scan_result_rendered_live_scans,
  c.context_refinement_shown_scans,
  c.context_refinement_submitted_scans,
  c.cta_shown_scans,
  c.cta_clicked_scans,
  c.pro_sales_viewed_scans,
  c.pro_unlock_clicked_scans,
  c.beta_unlock_started_scans,
  c.beta_unlock_completed_scans,
  c.payment_completed_scans,
  c.report_feedback_submitted_scans,
  round(c.scan_api_success_sessions::numeric / nullif(c.scan_submit_clicked_sessions, 0), 4) as submit_to_api_success_rate,
  round(c.scan_result_rendered_sessions::numeric / nullif(c.scan_submit_clicked_sessions, 0), 4) as submit_to_result_rate,
  round(c.scan_result_rendered_sessions::numeric / nullif(c.scan_api_success_sessions, 0), 4) as api_success_to_result_rate,
  round(c.cta_clicked_scans::numeric / nullif(c.cta_shown_scans, 0), 4) as cta_click_through_rate,
  round(c.pro_sales_viewed_scans::numeric / nullif(c.cta_clicked_scans, 0), 4) as cta_click_to_sales_view_rate,
  round(c.beta_unlock_completed_scans::numeric / nullif(c.pro_sales_viewed_scans, 0), 4) as sales_view_to_unlock_completed_rate,
  round(c.payment_completed_scans::numeric / nullif(c.pro_sales_viewed_scans, 0), 4) as sales_view_to_payment_completed_rate,
  round(c.context_refinement_submitted_scans::numeric / nullif(c.context_refinement_shown_scans, 0), 4) as refinement_submit_rate
from clean_daily c
join raw_daily r using (day_montreal)
order by c.day_montreal desc;


create or replace view public.ops_public_cta_segments_clean_v1 as
with base as (
  select
    timezone('America/Montreal', e.created_at)::date as day_montreal,
    e.event_type,
    e.scan_id,
    nullif(trim(e.context->>'session_id'), '') as session_id,
    coalesce(e.context->>'route', '') as route,
    coalesce(e.context->'props'->>'risk_tier', 'unknown') as risk_tier,
    coalesce(e.context->'props'->>'input_type', 'unknown') as input_type,
    coalesce(e.context->'props'->>'intel_state', 'unknown') as intel_state,
    coalesce(e.context->'props'->>'context_quality', 'unknown') as context_quality,
    coalesce(e.context->'props'->>'cta_reason', 'unknown') as cta_reason,
    coalesce(e.context->'props'->>'link_type', 'unknown') as link_type,
    coalesce(e.context->'props'->>'domain_signal', 'unknown') as domain_signal
  from public.events e
  where e.event_type in (
    'cta_shown',
    'cta_clicked',
    'pro_sales_viewed',
    'pro_unlock_clicked',
    'beta_unlock_started',
    'beta_unlock_completed',
    'payment_completed'
  )
),
scoped as (
  select
    b.*,
    (b.scan_id is not null and s.id is not null) as has_live_scan,
    (
      b.session_id = '94515dee-0533-435a-9744-31ce8ab8d6fc'
      or b.route ilike '/internal%'
      or b.route ilike '/msp/%'
      or b.route ilike '/partner/%'
    ) as is_internal_or_test
  from base b
  left join public.scans s on s.id = b.scan_id
)
select
  day_montreal,
  risk_tier,
  input_type,
  intel_state,
  context_quality,
  cta_reason,
  link_type,
  domain_signal,
  count(distinct scan_id) filter (
    where event_type = 'cta_shown'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as cta_shown_scans,
  count(distinct scan_id) filter (
    where event_type = 'cta_clicked'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as cta_clicked_scans,
  count(distinct scan_id) filter (
    where event_type = 'pro_sales_viewed'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as pro_sales_viewed_scans,
  count(distinct scan_id) filter (
    where event_type = 'pro_unlock_clicked'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as pro_unlock_clicked_scans,
  count(distinct scan_id) filter (
    where event_type = 'beta_unlock_started'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as beta_unlock_started_scans,
  count(distinct scan_id) filter (
    where event_type = 'beta_unlock_completed'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as beta_unlock_completed_scans,
  count(distinct scan_id) filter (
    where event_type = 'payment_completed'
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as payment_completed_scans,
  round(
    (count(distinct scan_id) filter (
      where event_type = 'cta_clicked'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ))::numeric
    / nullif(
      count(distinct scan_id) filter (
        where event_type = 'cta_shown'
          and scan_id is not null
          and has_live_scan
          and not is_internal_or_test
      ), 0
    ),
    4
  ) as cta_ctr,
  round(
    (count(distinct scan_id) filter (
      where event_type = 'beta_unlock_completed'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ))::numeric
    / nullif(
      count(distinct scan_id) filter (
        where event_type = 'pro_sales_viewed'
          and scan_id is not null
          and has_live_scan
          and not is_internal_or_test
      ), 0
    ),
    4
  ) as sales_to_unlock_completed_rate,
  round(
    (count(distinct scan_id) filter (
      where event_type = 'payment_completed'
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ))::numeric
    / nullif(
      count(distinct scan_id) filter (
        where event_type = 'pro_sales_viewed'
          and scan_id is not null
          and has_live_scan
          and not is_internal_or_test
      ), 0
    ),
    4
  ) as sales_to_payment_completed_rate
from scoped
group by 1,2,3,4,5,6,7,8
order by day_montreal desc, risk_tier, input_type, intel_state, context_quality, cta_reason, link_type, domain_signal;


-- public.ops_research_funnel_daily_v1  (DECISION view — v1.1.1)
-- Standalone. Does NOT reference ops_public_funnel_daily_clean_v1.
-- One row per Montreal day with only decision-safe columns.
-- All rates use scan-row / scan-row denominators and are bounded [0, 1].
-- Depends on public.intel_v2_clean_scans for is_valid_input.
--
-- DROP required: v1.1 had ~30+ inherited columns from the legacy funnel view.
-- Postgres CREATE OR REPLACE VIEW cannot remove columns (ERROR 42P16).
-- CASCADE is safe here: this view has no known dependents.
-- If you added a dependent view outside this repo, recreate it after this block.

drop view if exists public.ops_research_funnel_daily_v1 cascade;

create view public.ops_research_funnel_daily_v1 as
with scan_daily as (
  select
    timezone('America/Montreal', s.created_at)::date as day_montreal,
    count(*)::bigint as scans_table_scan_count,
    count(*) filter (
      where coalesce(v.is_valid_input, false)
    )::bigint as valid_scan_count,
    count(*) filter (
      where s.risk_tier in ('medium', 'high')
    )::bigint as medium_high_scan_count
  from public.scans s
  left join public.intel_v2_clean_scans v on v.id = s.id
  where not (
    coalesce(s.landing_path, '') ilike '/internal%'
    or coalesce(s.landing_path, '') ilike '/msp/%'
    or coalesce(s.landing_path, '') ilike '/partner/%'
  )
  group by 1
),
ur_daily as (
  select
    timezone('America/Montreal', r.created_at)::date as day_montreal,
    count(*)::bigint as user_research_responses
  from public.user_research_responses r
  join public.scans s on s.id = r.scan_id
  where not (
    coalesce(s.landing_path, '') ilike '/internal%'
    or coalesce(s.landing_path, '') ilike '/msp/%'
    or coalesce(s.landing_path, '') ilike '/partner/%'
  )
  group by 1
)
select
  sd.day_montreal,
  sd.scans_table_scan_count,
  sd.valid_scan_count,
  round(
    sd.valid_scan_count::numeric / nullif(sd.scans_table_scan_count, 0), 4
  ) as valid_scan_rate,
  sd.medium_high_scan_count,
  round(
    sd.medium_high_scan_count::numeric / nullif(sd.scans_table_scan_count, 0), 4
  ) as medium_high_scan_rate,
  coalesce(ur.user_research_responses, 0)::bigint as user_research_responses,
  round(
    coalesce(ur.user_research_responses, 0)::numeric / nullif(sd.scans_table_scan_count, 0), 4
  ) as research_response_per_scan_rate
from scan_daily sd
left join ur_daily ur using (day_montreal)
order by sd.day_montreal desc;


-- public.ops_event_health_daily_v1  (DIAGNOSTIC view — v1.1.1)
-- Counts-only projection of the legacy funnel view. No computed rates.
-- Column suffixes (_sessions / _scans) make the unit explicit.
-- Used by Daily Pulse diagnostic zone and auto-analysis engine.

drop view if exists public.ops_event_health_daily_v1 cascade;

create view public.ops_event_health_daily_v1 as
select
  day_montreal,
  scan_submit_clicked_sessions,
  scan_api_success_sessions,
  scan_result_rendered_sessions,
  cta_shown_scans,
  cta_clicked_scans,
  pro_sales_viewed_scans,
  pro_unlock_clicked_scans,
  beta_unlock_started_scans,
  beta_unlock_completed_scans,
  payment_completed_scans,
  context_refinement_shown_scans,
  context_refinement_submitted_scans,
  report_feedback_submitted_scans
from public.ops_public_funnel_daily_clean_v1;


-- public.ops_acquisition_signal_quality_daily_v1
-- Acquisition signal quality by scan attribution (UTM) and Montreal day.
-- Grouping includes utm_term and utm_content for creative/keyword-level signal.
-- valid_scan_* uses intel_v2_clean_scans.is_valid_input (same definition as internal radar).
-- Naming: supersedes the earlier "ops_ads_quality_daily_v1" label; do not drop legacy
-- views in Supabase if you still rely on them — this file only creates/replaces the v1 names below.

create or replace view public.ops_acquisition_signal_quality_daily_v1 as
with scan_rows as (
  select
    timezone('America/Montreal', s.created_at)::date as day_montreal,
    coalesce(nullif(trim(s.utm_source), ''), '') as utm_source,
    coalesce(nullif(trim(s.utm_medium), ''), '') as utm_medium,
    coalesce(nullif(trim(s.utm_campaign), ''), '') as utm_campaign,
    coalesce(nullif(trim(s.utm_term), ''), '') as utm_term,
    coalesce(nullif(trim(s.utm_content), ''), '') as utm_content,
    s.id as scan_id,
    coalesce(v.is_valid_input, false) as is_valid_input,
    (
      coalesce(s.landing_path, '') ilike '/internal%'
      or coalesce(s.landing_path, '') ilike '/msp/%'
      or coalesce(s.landing_path, '') ilike '/partner/%'
    ) as is_internal_or_test
  from public.scans s
  left join public.intel_v2_clean_scans v on v.id = s.id
),
scan_agg as (
  select
    day_montreal,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    count(*) filter (where not is_internal_or_test)::bigint as scan_count,
    count(*) filter (where not is_internal_or_test and is_valid_input)::bigint as valid_scan_count,
    round(
      (count(*) filter (where not is_internal_or_test and is_valid_input))::numeric
        / nullif(count(*) filter (where not is_internal_or_test), 0),
      4
    ) as valid_scan_rate
  from scan_rows
  group by 1, 2, 3, 4, 5, 6
),
ur_agg as (
  select
    timezone('America/Montreal', r.created_at)::date as day_montreal,
    coalesce(nullif(trim(s.utm_source), ''), '') as utm_source,
    coalesce(nullif(trim(s.utm_medium), ''), '') as utm_medium,
    coalesce(nullif(trim(s.utm_campaign), ''), '') as utm_campaign,
    coalesce(nullif(trim(s.utm_term), ''), '') as utm_term,
    coalesce(nullif(trim(s.utm_content), ''), '') as utm_content,
    count(*)::bigint as user_research_responses
  from public.user_research_responses r
  join public.scans s on s.id = r.scan_id
  where not (
    coalesce(s.landing_path, '') ilike '/internal%'
    or coalesce(s.landing_path, '') ilike '/msp/%'
    or coalesce(s.landing_path, '') ilike '/partner/%'
  )
  group by 1, 2, 3, 4, 5, 6
)
select
  s.day_montreal,
  s.utm_source,
  s.utm_medium,
  s.utm_campaign,
  s.utm_term,
  s.utm_content,
  s.scan_count,
  s.valid_scan_count,
  s.valid_scan_rate,
  coalesce(u.user_research_responses, 0)::bigint as user_research_responses,
  round(
    coalesce(u.user_research_responses, 0)::numeric / nullif(s.scan_count, 0),
    4
  ) as user_research_per_scan_rate
from scan_agg s
left join ur_agg u
  on u.day_montreal = s.day_montreal
  and u.utm_source is not distinct from s.utm_source
  and u.utm_medium is not distinct from s.utm_medium
  and u.utm_campaign is not distinct from s.utm_campaign
  and u.utm_term is not distinct from s.utm_term
  and u.utm_content is not distinct from s.utm_content
order by
  s.day_montreal desc,
  s.scan_count desc,
  s.utm_source,
  s.utm_medium,
  s.utm_campaign,
  s.utm_term,
  s.utm_content;


-- public.ops_user_research_export_v1
-- Per-row export of post-scan PMF research for the Founder Control Panel.
-- Joined to public.scans (risk_tier) and to the latest non-expired
-- public.pro_report_access token (already user-shareable as /r/{token}).
--
-- PRIVACY: user_words (q2_problem_text) is explicit user research input and may
-- contain sensitive details. Internal founder analysis only. The workbook that
-- consumes this view must remain restricted to founder access.
-- This view intentionally does NOT include raw scan message text, OCR text, or
-- signed URLs.

create or replace view public.ops_user_research_export_v1 as
select
  r.created_at        as submitted_at,
  r.scan_id           as scan_id,
  case
    when t.access_token is null then null
    else '/r/' || t.access_token
  end                 as report_url,
  r.lang              as language,
  r.q1_situation      as situation,
  r.q2_problem_text   as user_words,
  array_to_string(r.q3_help_options, ', ') as desired_help,
  r.q3_help_other     as other_help,
  r.q4_price_range    as price_range,
  s.risk_tier         as risk_tier,
  r.source            as source,
  r.referrer          as referrer
from public.user_research_responses r
left join public.scans s
  on s.id = r.scan_id
left join lateral (
  select pa.access_token
  from public.pro_report_access pa
  where pa.scan_id = r.scan_id
    and pa.expires_at > now()
  order by pa.created_at desc
  limit 1
) t on true
order by r.created_at desc;
