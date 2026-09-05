# Product telemetry and agent analysis

## Goal

Product telemetry answers product questions without storing message text, story text, contact details, URLs, or other private content.

The canonical event vocabulary and allowed property keys live in:

- `lib/telemetry/events.ts`
- client sender: `lib/telemetry/logScanEvent.ts`
- server validator: `app/api/telemetry/route.ts`

Do not add a product event in only one place. Extend the shared contract first.

## Privacy boundary

Telemetry may contain:

- ephemeral session ID
- scan ID
- route / UI surface
- normalized product intent
- normalized Atlas taxonomy
- risk tier / context quality
- coarse performance timings
- attribution parameters already used by the product

Telemetry must never contain:

- pasted message or story text
- prompts or free-text form values
- email addresses or phone numbers
- URLs or domains
- passwords, codes, card data, identity numbers
- private Journey ledger content

The API hard-rejects payloads containing banned content-like keys.

## Agent-readable views

All views are service-role-only and use `security_invoker=true`.

### `product_events_v1`

Normalized event stream. Common fields:

- `created_at`
- `event_type`
- `build_id` (Vercel Git commit SHA when available)
- `session_id`
- `scan_id`
- `route`
- `surface`
- `intent`
- `entry_mode`
- `risk_tier`
- `current_family`
- `channel`
- `primary_request`
- `total_ms`, `ai_ms`, `ocr_ms`, `link_intel_ms`, `persist_ms`

### `product_funnel_daily_v1`

Daily event/session/scan counts by event type.

### `product_intent_daily_v1`

Daily intent selections. This is the primary view for answering:

- Do visitors want to scan, explore, understand an experience, protect family, or learn?
- Which post-scan action is selected?
- Does intent differ by surface?

### `product_scan_performance_daily_v1`

Daily scan latency:

- average / p50 / p90 total duration
- AI duration
- URL intelligence duration
- OCR duration
- persistence duration

## Core events for the new product loop

- `intent_selected`
  - `surface=home`
  - `intent=scan | explore_atlas | something_happened | protect_family | learn`
- `post_scan_action_selected`
  - `surface=result`
  - `intent=atlas | journey | rescue | scan_another`
- `atlas_viewed`
- `atlas_current_opened`
- `atlas_find_mine_clicked`
- `journey_started`
- `journey_completed`
- `contribution_prompt_viewed`
- `contribution_submitted`
- `family_interest_started`
- `cognitive_defense_opened`
- `network_contact_clicked`
- `scan_stage_timing`

Legacy events remain accepted while older deployed clients age out.

## Standard agent queries

### What are people trying to do?

```sql
select
  surface,
  intent,
  sum(events) as events,
  sum(sessions) as sessions
from public.product_intent_daily_v1
where day >= current_date - 30
group by surface, intent
order by sessions desc, events desc;
```

### Scan funnel

```sql
select
  event_type,
  sum(events) as events,
  sum(sessions) as sessions,
  sum(scans) as scans
from public.product_funnel_daily_v1
where day >= current_date - 30
  and event_type in (
    'scan_submit_clicked',
    'scan_request_sent',
    'scan_result_received',
    'scan_result_rendered'
  )
group by event_type
order by events desc;
```

### What do people do after a scan?

```sql
select
  intent,
  count(*) as events,
  count(distinct session_id) as sessions,
  count(distinct scan_id) as scans
from public.product_events_v1
where created_at >= now() - interval '30 days'
  and event_type = 'post_scan_action_selected'
group by intent
order by sessions desc;
```

### Atlas engagement

```sql
select
  event_type,
  count(*) as events,
  count(distinct session_id) as sessions
from public.product_events_v1
where created_at >= now() - interval '30 days'
  and event_type in (
    'atlas_viewed',
    'atlas_current_opened',
    'atlas_find_mine_clicked',
    'journey_started',
    'journey_completed',
    'contribution_prompt_viewed',
    'contribution_submitted'
  )
group by event_type
order by events desc;
```

### Scanner performance

```sql
select *
from public.product_scan_performance_daily_v1
where day >= current_date - 30
order by day desc;
```

## Interpretation rules for agents

1. Prefer distinct `session_id` for user-intent questions.
2. Prefer distinct `scan_id` for scan-level questions.
3. Event counts can exceed people because a person may act more than once.
4. Do not infer conversion from unrelated historical event names without checking their instrumentation dates.
5. State when sample sizes are small.
6. Compare before/after product changes by `build_id` when available; otherwise use a precise date window.
7. Never query raw message/story tables for ordinary product analytics.
