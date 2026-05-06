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

Source/debug tabs:
- `DATA_Public Funnel`
- `DATA_CTA Segments`
- `DATA_Event Funnel Debug`
- `DATA_Meta`

Important:
- Old tabs are left untouched.
- New tabs are created beside old tabs if missing.
- Script only clears tabs it owns (`DATA_*`, `Daily Pulse`, `DATA_Meta`).

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
