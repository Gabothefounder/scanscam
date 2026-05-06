# Founder Control Panel - Public Funnel Automation

This module is the **public/user pipeline automation layer** for the existing Founder Control Panel workbook.

It is intentionally scoped to:
- read-only analytics
- Supabase views
- Google Sheet prefill

It does **not**:
- modify product logic
- modify scan analysis logic
- modify UI
- automate strategy decisions
- add MSP automation

## Files

- `founder-control/public_funnel_views.sql`
  - Creates/updates:
    - `public.ops_public_funnel_daily_clean_v1`
    - `public.ops_public_cta_segments_clean_v1`
- `founder-control/founder_control_panel.gs`
  - Google Apps Script for workbook refresh and daily control row.

## Setup

1. Run SQL in Supabase SQL Editor
   - Open `founder-control/public_funnel_views.sql`.
   - Execute.

2. Open the target workbook
   - `ScanScam - Founder Control Panel`

3. Open Apps Script
   - Google Sheet -> Extensions -> Apps Script

4. Paste script
   - Copy `founder-control/founder_control_panel.gs` into the project.

5. Add Script Properties
   - `SUPABASE_URL` (example: `https://<project>.supabase.co`)
   - `SUPABASE_KEY` (prefer anon key if view access allows it; else restricted service key)

6. Run once manually
   - Run `refreshFounderControlPanel()`.

7. Verify tabs
   - `Public Funnel`
   - `CTA Segments`
   - `Daily Public Control`
   - `_Meta`

8. Add trigger
   - Apps Script -> Triggers -> Add Trigger
   - Function: `refreshFounderControlPanel`
   - Event source: Time-driven
   - Frequency: Daily
   - Target: around 7:00 AM America/Montreal

9. Check `_Meta`
   - Last refresh timestamp (America/Montreal)
   - Selected target day and status
   - Warnings (fallback/partial-day flags)

## Assumptions / Warnings

- Event route and context fields are best-effort; if route is missing, route-based exclusion cannot apply.
- `payment_completed` may be absent for now; view handles zero counts.
- Daily decision row defaults to **yesterday** (Montreal date). If missing:
  - uses latest available day
  - marks `FALLBACK`
  - if latest is today, marks `PARTIAL DAY - DO NOT OVERREAD`
