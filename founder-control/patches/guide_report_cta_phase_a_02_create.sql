-- STEP 2 of 2 — Run AFTER guide_report_cta_phase_a_01_drop.sql verification returns 0 rows.
-- Creates-only (no DROP). Uses CREATE VIEW, not CREATE OR REPLACE.
-- (Same body as guide_report_cta_phase_a.sql)
--
-- Do NOT use CREATE OR REPLACE (causes ERROR 42P16 if column list differs).
-- Do NOT run the full public_funnel_views.sql file — it contains unrelated
-- CREATE OR REPLACE views (acquisition, user research) that may also fail.

create view public.ops_public_funnel_daily_clean_v1 as
with allowed_events as (
  select unnest(array[
    'scan_submit_clicked',
    'scan_api_success',
    'scan_result_rendered',
    'context_refinement_shown',
    'context_refinement_submitted',
    'cta_shown',
    'cta_clicked',
    'guide_report_cta_viewed',
    'guide_report_cta_clicked',
    'guide_report_optin_submitted',
    'guide_report_unlocked',
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
      where event_type in ('cta_shown', 'guide_report_cta_viewed')
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ) as cta_shown_scans,
    count(distinct scan_id) filter (
      where event_type in ('cta_clicked', 'guide_report_cta_clicked')
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


create view public.ops_public_cta_segments_clean_v1 as
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
    'guide_report_cta_viewed',
    'guide_report_cta_clicked',
    'guide_report_optin_submitted',
    'guide_report_unlocked',
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
    where event_type in ('cta_shown', 'guide_report_cta_viewed')
      and scan_id is not null
      and has_live_scan
      and not is_internal_or_test
  ) as cta_shown_scans,
  count(distinct scan_id) filter (
    where event_type in ('cta_clicked', 'guide_report_cta_clicked')
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
      where event_type in ('cta_clicked', 'guide_report_cta_clicked')
        and scan_id is not null
        and has_live_scan
        and not is_internal_or_test
    ))::numeric
    / nullif(
      count(distinct scan_id) filter (
        where event_type in ('cta_shown', 'guide_report_cta_viewed')
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
