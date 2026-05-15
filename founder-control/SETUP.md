# Founder Control Panel - Public Module Setup

This module is the **public/user pipeline automation layer** inside the existing
`ScanScam - Founder Control Panel` workbook.

Scope:

- read-only Supabase view pulls
- raw/debug data tab population
- one founder-facing daily summary row (Daily Pulse)

Out of scope:

- production app logic changes
- scan analysis changes
- app UI changes
- new client-side analytics events
- database table schema changes (views only)
- Google Ads automation
- MSP automation
- Product & Signal automation
- strategy automation

## Architecture (v1.1.1) — 3-view model

```
DECISION         ops_research_funnel_daily_v1        -> Daily Pulse cols 1-9
DIAGNOSTIC       ops_event_health_daily_v1           -> Daily Pulse cols 10-20
LEGACY           ops_public_funnel_daily_clean_v1    -> DATA_Public Funnel (archive)
```

- **Supabase SQL views** hold all business logic.
- **Apps Script** only: fetches views into `DATA_*` tabs, fills **Daily Pulse** from the decision and
  diagnostic views, and stamps **DATA_Meta**. No LLM calls, no ad APIs, no extra transforms.

### Decision view: `ops_research_funnel_daily_v1`

Standalone (does NOT reference `ops_public_funnel_daily_clean_v1`). One row per Montreal day.

Columns:

| Column | Unit | Source |
|---|---|---|
| `day_montreal` | date | `public.scans.created_at` |
| `scans_table_scan_count` | scan rows | `public.scans` (excl. internal/msp/partner) |
| `valid_scan_count` | scan rows | `intel_v2_clean_scans.is_valid_input` |
| `valid_scan_rate` | scan/scan | `valid_scan_count / scans_table_scan_count` |
| `medium_high_scan_count` | scan rows | `scans.risk_tier in ('medium','high')` |
| `medium_high_scan_rate` | scan/scan | `medium_high_scan_count / scans_table_scan_count` |
| `user_research_responses` | response rows | `user_research_responses` (1:1 with scan) |
| `research_response_per_scan_rate` | scan/scan | `user_research_responses / scans_table_scan_count` |

Every rate uses the same denominator (`scans_table_scan_count`) and is bounded [0, 1].

### Diagnostic view: `ops_event_health_daily_v1`

Thin counts-only projection of the legacy funnel view. **No computed rates.**
Column suffixes (`_sessions` / `_scans`) make the unit explicit.

Used by Daily Pulse diagnostic zone and the auto-analysis engine (drop-off detection,
instrumentation status, diagnosis, suggested action).

### Legacy view: `ops_public_funnel_daily_clean_v1`

Unchanged. Synced to `DATA_Public Funnel` for historical reference. Contains event-telemetry
counts **and** computed rates (some of which can exceed 1.0). Not used for Daily Pulse decisions.

### Unit-consistency rule

Every rate exposed to the founder must use same-unit numerator/denominator:

- scan-row / scan-row (decision view)
- session / session or scan / scan within the same comparison (diagnostic auto-analysis)
- **Never** mix scan_id numerator with session_id denominator (or vice versa)

Rates that can exceed 1.0 exist only in the legacy view (`DATA_Public Funnel`), never in
Daily Pulse or the decision view.

## Migration-safe behavior

- No app UI changes, no new events, no table DDL — only `create or replace view`.
- **Do not drop** legacy views in Supabase; this repo only creates/replaces the v1 names.
- Legacy paid-report workbook tabs are **archive-only** (rename or park manually; the script
  does not delete or clear tabs it does not own).

## Files

- `founder-control/public_funnel_views.sql`
  - Defines / replaces:
    - `public.ops_public_funnel_daily_clean_v1` (legacy, unchanged)
    - `public.ops_public_cta_segments_clean_v1` (unchanged)
    - `public.ops_research_funnel_daily_v1` (decision-safe, standalone)
    - `public.ops_event_health_daily_v1` (diagnostic, counts only)
    - `public.ops_acquisition_signal_quality_daily_v1` (UTM-level, unchanged)
    - `public.ops_user_research_export_v1` (unchanged)
  - **Prerequisite:** `public.intel_v2_clean_scans` must exist (see migration
    `supabase/migrations/2026_04_08_intel_v2_system_analysis.sql`).

- `founder-control/founder_control_panel.gs`
  - Apps Script (Supabase fetch + sheet writing + Daily Pulse)

## Sheet structure used by script

Founder-facing tabs:

- `Weekly Control Panel` (v1.3 hybrid — automated summary + manual decision log)
- `Daily Pulse` (decision zone from `ops_research_funnel_daily_v1`, diagnostic zone from
  `ops_event_health_daily_v1`)
- `Growth Lab`
- `Product & Signal`
- `Sales CRM`
- `User Research Summary` (founder analysis skeleton, manual fill)
- `LLM Prompts` (reusable prompts for manual Gemini/ChatGPT analysis)
- `Operating Map` (v1.2 — workbook-level system-of-record; seed-once)

Source/debug tabs (synced each run):

- `DATA_Public Funnel` — legacy archive (`ops_public_funnel_daily_clean_v1`)
- `DATA_CTA Segments` (`ops_public_cta_segments_clean_v1`)
- `DATA_Acquisition Signal Quality` (`ops_acquisition_signal_quality_daily_v1`)
- `DATA_User Research` (raw daily sync from `ops_user_research_export_v1`)
- `DATA_Event Funnel Debug`
- `DATA_Meta`

Important:

- Old / legacy tabs are left untouched by the script.
- New tabs are created beside old tabs if missing.
- Script only clears tabs it owns (`DATA_*` listed above, `Daily Pulse`, `DATA_Meta`).
- `Weekly Control Panel` automated section (rows 1–14) is refreshed each run; the manual
  decision log (row 16+) is seeded once and never overwritten.
- `User Research Summary`, `LLM Prompts`, and `Operating Map` are **seeded once when empty**;
  the daily refresh never overwrites founder edits in those tabs.

## Daily Pulse layout (v1.1.1)

**Decision zone (cols 1-9)** — from `ops_research_funnel_daily_v1`:

1. Date
2. Day Status
3. User Research Responses
4. Total Scans
5. Valid Scans
6. Valid Scan Rate
7. Medium/High Scans
8. Medium/High Scan Rate
9. Research / Scan Rate

**Diagnostic zone (cols 10-20)** — from `ops_event_health_daily_v1`:

10. Scan Submits [sessions]
11. API Success [sessions]
12. Results [sessions]
13. CTA Shown [scans]
14. CTA Clicked [scans]
15. Sales Views [scans]
16. Unlock [scans]
17. Payment [scans]
18. Refinement Shown [scans]
19. Refinement Submitted [scans]
20. API Gap [sessions]

**Auto-analysis (cols 21-24)** — driven by diagnostic counts:

21. Main Drop-Off
22. Instrumentation Status
23. Auto Diagnosis
24. Suggested Action

**Manual (cols 25-30)**:

25. Ad Spend
26. Clicks
27. Founder Approved?
28. Decision Logged?
29. Experiment Logged?
30. Notes

## Weekly Control Panel (v1.3) — hybrid layout

The Weekly Control Panel is a **hybrid tab**: the script refreshes an automated summary
section at the top on every run, while a manual decision log below row 16 is seeded once
and never overwritten.

### Automated section (rows 1–14, refreshed each run)

**Block 1 — Weekly Metrics (rows 1–2)**

Source: `ops_research_funnel_daily_v1` (7-day window: yesterday minus 6 days through yesterday).

| Col | Header | Computation |
|-----|--------|-------------|
| A | Week Start | Monday of window |
| B | Week End | Yesterday (Montreal) |
| C | Total Scans | SUM(scans_table_scan_count) |
| D | Valid Scans | SUM(valid_scan_count) |
| E | Avg Valid Scan Rate | SUM(valid) / SUM(total) |
| F | Medium/High Scans | SUM(medium_high_scan_count) |
| G | Avg Medium/High Scan Rate | SUM(medium_high) / SUM(total) |
| H | User Research Responses | SUM(user_research_responses) |
| I | Avg Research / Scan Rate | SUM(responses) / SUM(total) |
| J | Main Weekly Bottleneck | Decision-safe only (no CTA/sales/payment) |
| K | Suggested Weekly Focus | Mapped from bottleneck |

All rate denominators use `scans_table_scan_count` (scan-row / scan-row).

**Block 2 — Acquisition (rows 4–6)**

Source: `ops_acquisition_signal_quality_daily_v1` (same 7-day window).

| Col | Header | Rule |
|-----|--------|------|
| A | Top UTM Source | Highest scan_count |
| B | Top Campaign | Highest scan_count |
| C | Best Valid Scan Rate Source | Highest valid_scan_rate (min 5 scans) |
| D | Worst Valid Scan Rate Source | Lowest valid_scan_rate (min 20 scans) |
| E | Paid Scan Count | utm_medium contains "cpc" or "paid" |
| F | Organic Scan Count | utm_medium empty, "(none)", "organic", or null |
| G | UTM Coverage Warning | Shown if >50% of scans have empty utm_source |

UTM warning text: "UTM attribution incomplete — keyword-level optimization unavailable."

If no source has >=20 scans for worst rate: "Not enough source-level volume".

**Block 3 — User Research (rows 8–10)**

Source: `ops_user_research_export_v1` (same 7-day window, filtered by `submitted_at`).

| Col | Header | Rule |
|-----|--------|------|
| A | Research Response Count | Count of rows in window |
| B | Dominant User Need | Most frequent `q1_situation` |
| C | Pricing Signal | Most frequent `q4_price_range` |
| D | Product Signal | Most frequent `desired_help` |
| E | Quote / Note | (blank — manual founder entry) |
| F | Needs LLM Review? | "Yes" if count >= 5, else "Not enough data" |

**Block 4 — LLM Prompt (rows 12–13)**

Static text for copy/paste into Gemini or ChatGPT.

### Manual section (row 16+, seed-once)

**Block 5 — Weekly Decision Log (row 16 header, row 17 column headers)**

Seeded once when the tab is new. Headers:

- Week Start
- Founder Decision
- Next Experiment
- Review Date
- Notes

Row 18+ is founder-entered. The script never clears or overwrites row 16 onward after first
seed.

### Weekly bottleneck detection

Uses decision-safe metrics only. Priority order:

1. `totalScans < 20` → "No clear bottleneck / needs more data"
2. `avgValidRate < 0.30` → "Low Valid Scan Rate"
3. `avgMedHighRate < 0.10` → "Low Medium/High Rate"
4. `avgResearchRate < 0.03` → "Low Research Response Rate"
5. Otherwise → "No clear bottleneck / needs more data"

No CTA, sales page, unlock, or payment metrics are used.

## DATA_Acquisition Signal Quality

Per Montreal day and full UTM tuple (**source, medium, campaign, term, content**), aggregates
public scans (excluding internal/partner-style `landing_path`), `valid_scan_count` /
`valid_scan_rate` from `intel_v2_clean_scans.is_valid_input`, and post-scan **user research**
counts aligned to the scan's attribution.

## DATA_User Research

Daily pull of post-scan user research responses (`public.user_research_responses`) joined to
`public.scans` (risk_tier) and to the latest non-expired `public.pro_report_access` token.

Source view: `public.ops_user_research_export_v1`

Privacy: "User Words" comes from explicit user research input and may contain sensitive details.
The workbook must remain restricted to founder access.

## User Research Summary

Founder-readable analysis skeleton for PMF review. Section labels only on first seed; no
formulas. Filled manually or with paste-from-LLM output. The script will not overwrite this tab
once it has any content.

## LLM Prompts

Reusable prompts for **manual** Gemini/ChatGPT analysis of `DATA_User Research`. Reference-only;
the script does not call any LLM API. Seeded once when the tab is empty.

## Operating Map (v1.2)

Workbook-level system-of-record. Every tab is catalogued with its layer, primary question,
data flow, automation status, update frequency, and current status.

Layers follow the intended data flow:

```
DATA → PULSE → INTERPRETATION → DECISION → EXPERIMENT / SALES / ACTION
```

The tab is seeded once (when empty) and never overwritten by the daily refresh, so the
founder can annotate freely.

Key status notes (v1.2 / v1.3):

- **DATA_CTA Segments** — `Active / legacy-derived`. Relies on legacy CTA event telemetry;
  useful for segment drill-down but not for primary product decisions.
- **Weekly Control Panel** — `Active (v1.3)`. Automated decision-safe summary from
  `ops_research_funnel_daily_v1`, `ops_acquisition_signal_quality_daily_v1`, and
  `ops_user_research_export_v1`. Manual decision log preserved below row 16.
- **DATA_Event Funnel Debug** — `Stale / orphaned`. No Supabase view feeds it; candidate
  for wiring to `ops_event_health_daily_v1` or archiving.
- **Product & Signal** — `Needs wiring`. Headers overlap with decision-view metrics and
  could pull from `ops_research_funnel_daily_v1`.

## Phase 1: no automatic LLM analysis

Phase 1 is intentionally **pull data + manual review**:

- No OpenAI / Gemini API calls.
- No Apps Script `UrlFetch` calls to an LLM.
- No automated `LLM Insights` tab.

## Daily usage

1. Read `Daily Pulse` first — decision metrics (cols 1-9) are your primary signal.
2. Diagnostic metrics (cols 10-20) explain instrumentation gaps; do not use for product decisions.
3. Use `DATA_Public Funnel`, `DATA_CTA Segments`, and `DATA_Acquisition Signal Quality` for
   drill-down.
4. Keep Ad Spend/Clicks manual for now (cols 25-26).
5. Use `Weekly Control Panel` for weekly founder review — the automated summary (rows 1–14)
   refreshes automatically; add decisions in the manual decision log (row 18+).

Gemini guidance:

- Daily: read `Daily Pulse` + `DATA_CTA Segments` + `DATA_Acquisition Signal Quality`.
- Weekly: read `Weekly Control Panel` automated summary, then review and update the
  decision log. Use the embedded LLM prompt (row 13) for a single-priority recommendation.

## Setup

1. Run SQL in Supabase SQL Editor
   - Open `founder-control/public_funnel_views.sql`.
   - Execute (after migrations that create `intel_v2_clean_scans`, `user_research_responses`,
     and scan UTM columns).

2. Open workbook — `ScanScam - Founder Control Panel`

3. Open Apps Script — Extensions -> Apps Script

4. Paste/update script
   - Copy `founder-control/founder_control_panel.gs`.
   - Save.

5. Set Script Properties
   - `SUPABASE_URL` (e.g. `https://<project>.supabase.co`)
   - `SUPABASE_KEY`

6. Run once manually — `refreshFounderControlPanel()`

7. Refresh the Sheet and verify:
   - `Daily Pulse` (decision cols have data; diagnostic cols have data; rates in [0, 1])
   - `DATA_Public Funnel`
   - `DATA_CTA Segments`
   - `DATA_Acquisition Signal Quality`
   - `DATA_User Research`
   - `DATA_Meta` (lists all 6 source views)

8. Add daily trigger
   - Function: `refreshFounderControlPanel`
   - Type: time-driven
   - Frequency: daily
   - Target: around 7:00 AM America/Montreal

## Verification queries

After running the SQL, validate in Supabase SQL Editor:

```sql
-- Decision view: all rates should be in [0, 1] or null.
select day_montreal, valid_scan_rate, medium_high_scan_rate, research_response_per_scan_rate
from ops_research_funnel_daily_v1
where valid_scan_rate > 1 or medium_high_scan_rate > 1 or research_response_per_scan_rate > 1;
-- Expected: 0 rows.

-- Event health view: no rate columns should exist.
select column_name
from information_schema.columns
where table_name = 'ops_event_health_daily_v1' and column_name like '%rate%';
-- Expected: 0 rows.

-- Confirm legacy view is unchanged.
select count(*) from ops_public_funnel_daily_clean_v1;
-- Expected: same count as before.
```

## Rollback

If v1.1.1 views produce unexpected results:

1. The legacy view (`ops_public_funnel_daily_clean_v1`) is unchanged — `DATA_Public Funnel` is
   unaffected.
2. To revert the decision view, re-run the v1.1 SQL that used `f.*` from the legacy view.
3. To revert the event health view, drop it: `drop view if exists public.ops_event_health_daily_v1;`
4. Revert `founder_control_panel.gs` to the v1.1 version from git.

## Security notes

- Keep Supabase keys in Script Properties only.
- Do not hardcode keys in script.
- Prefer anon key for sanitized aggregate views when possible.
- Be cautious with editor access if service-role-like keys are used.

## Limitations / warnings

- `Daily Pulse` is generated each run and may overwrite manual notes in that tab.
- Old tabs are intentionally untouched and must be manually archived/migrated later.
- If the selected daily row is today, the row is marked: `PARTIAL DAY - DO NOT OVERREAD`.

## Survey experiments (Supabase → Founder Control Panel)

Landing-page surveys (e.g. `/parking-ticket-text`) write to **`public.survey_experiment_responses`** via Next.js (`POST /api/parking-text/sheet`) using **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** on Vercel/local.

1. Run migration `supabase/migrations/20260515120000_survey_experiment_responses.sql` in the Supabase SQL Editor (or your migration workflow).
2. Confirm view **`ops_survey_experiment_export_v1`** exists.
3. Update **`founder_control_panel.gs`** in the bound Apps Script project (includes pull to **`DATA_Survey_Experiments`**).
4. Run **`refreshFounderControlPanel()`** once after a test completion.
5. Verify rows in Supabase Table Editor and in sheet tab **`DATA_Survey_Experiments`**.

**Retired:** `parking_text_survey_webapp.gs` (Apps Script Web App ingestion). Do not use `PARKING_TEXT_SHEET_WEBHOOK_URL` / `PARKING_TEXT_SHEET_WEBHOOK_SECRET`.
