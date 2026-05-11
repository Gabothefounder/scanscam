# Founder Control Panel - Public Module Setup

This module is the **public/user pipeline automation layer** inside the existing
`ScanScam - Founder Control Panel` workbook.

Scope:
- read-only Supabase view pulls
- raw/debug data tab population
- one founder-facing daily summary row

Out of scope:
- production app logic changes
- scan analysis changes
- UI changes
- Google Ads automation
- MSP automation
- Product & Signal automation
- strategy automation

## Files

- `founder-control/public_funnel_views.sql`
  - Uses existing views:
    - `public.ops_public_funnel_daily_clean_v1`
    - `public.ops_public_cta_segments_clean_v1`
- `founder-control/founder_control_panel.gs`
  - Working Apps Script (Supabase fetch + sheet writing)

## Sheet structure used by script

Founder-facing tabs:
- `Weekly Control Panel`
- `Daily Pulse`
- `Growth Lab`
- `Product & Signal`
- `Sales CRM`
- `User Research Summary` (founder analysis skeleton, manual fill)
- `LLM Prompts` (reusable prompts for manual Gemini/ChatGPT analysis)

Source/debug tabs:
- `DATA_Public Funnel`
- `DATA_CTA Segments`
- `DATA_User Research` (raw daily sync from `public.ops_user_research_export_v1`)
- `DATA_Event Funnel Debug`
- `DATA_Meta`

Important:
- Old tabs are left untouched.
- New tabs are created beside old tabs if missing.
- Script only clears tabs it owns (`DATA_*`, `Daily Pulse`, `DATA_Meta`).
- `User Research Summary` and `LLM Prompts` are **seeded once when empty**; the
  daily refresh never overwrites founder edits in those two tabs.

## DATA_User Research

Purpose:
Daily pull of post-scan user research responses
(`public.user_research_responses`) joined to `public.scans` (risk_tier) and
to the latest non-expired `public.pro_report_access` token.

Source view:
`public.ops_user_research_export_v1`

Columns (in order):
- Submitted At
- Scan ID
- Report URL
- Language
- Situation
- User Words
- Desired Help
- Other Help
- Price Range
- Risk Tier
- Source
- Referrer

Privacy:
"User Words" comes from explicit user research input and may contain sensitive
details. The workbook must remain restricted to founder access; do not share
the workbook broadly or export this tab to untrusted destinations.

## User Research Summary

Purpose:
Founder-readable analysis skeleton for PMF review. Section labels only on first
seed; no formulas. Filled manually or with paste-from-LLM output. The script
will not overwrite this tab once it has any content.

Sections:
- Volume (total / 24h / 7d)
- Top Situations
- Top Desired Help
- Price Signal
- Premium / Concierge Signal
- User Language Themes
- Next Experiment

## LLM Prompts

Purpose:
Reusable prompts for **manual** Gemini/ChatGPT analysis of `DATA_User Research`.
Reference-only; the script does not call any LLM API.

Headers:
`Prompt Name | Use Case | Frequency | Prompt | Last Used | Output Destination`

Seeded prompts (first run only):
- Daily User Research Review
- Weekly PMF Review
- Copywriting Gold
- Premium Concierge Signal Review

You can edit any cell (including the prompt text and `Last Used`) safely; the
script only seeds when the tab is empty.

## Phase 1: no automatic LLM analysis

Phase 1 is intentionally **pull data + manual review**:
- No OpenAI / Gemini API calls.
- No Apps Script `UrlFetch` calls to an LLM.
- No automated `LLM Insights` tab.

A future `LLM Insights` tab may be added once response volume is sufficient and
prompt outputs have stabilized.

## Daily usage

1. Read `Daily Pulse` first (decision row).
2. Use `DATA_Public Funnel` and `DATA_CTA Segments` for debugging/support.
3. Keep Ad Spend/Clicks manual for now.
4. Use `Weekly Control Panel` for weekly founder review.

Gemini guidance:
- Daily: read `Daily Pulse` + `DATA_CTA Segments`.
- Weekly: read `Weekly Control Panel`.

## Setup

1. Run SQL in Supabase SQL Editor
   - Open `founder-control/public_funnel_views.sql`.
   - Execute.

2. Open workbook
   - `ScanScam - Founder Control Panel`

3. Open Apps Script
   - Extensions -> Apps Script

4. Paste/update script
   - Copy `founder-control/founder_control_panel.gs`.
   - Save.

5. Set Script Properties
   - `SUPABASE_URL` (e.g. `https://<project>.supabase.co`)
   - `SUPABASE_KEY`

6. Run once manually
   - `refreshFounderControlPanel()`

7. Refresh the Sheet and verify:
   - `Daily Pulse`
   - `DATA_Public Funnel`
   - `DATA_CTA Segments`
   - `DATA_Meta`

8. Add daily trigger
   - Function: `refreshFounderControlPanel`
   - Type: time-driven
   - Frequency: daily
   - Target: around 7:00 AM America/Montreal

## Security notes

- Keep Supabase keys in Script Properties only.
- Do not hardcode keys in script.
- Prefer anon key for sanitized aggregate views when possible.
- Be cautious with editor access if service-role-like keys are used.

## Limitations / warnings

- `Daily Pulse` is generated each run and may overwrite manual notes in that tab.
- Old tabs are intentionally untouched and must be manually archived/migrated later.
- If the selected daily row is today, the row is marked:
  `PARTIAL DAY - DO NOT OVERREAD`.
