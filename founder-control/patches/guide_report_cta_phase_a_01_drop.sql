-- STEP 1 of 2 — Run this FIRST in Supabase SQL Editor.
-- Confirms all three Phase A views are removed before CREATE (avoids ERROR 42P16).
-- Expected result: 0 rows from the verification query below.

drop view if exists public.ops_event_health_daily_v1 cascade;

drop view if exists public.ops_public_cta_segments_clean_v1 cascade;

drop view if exists public.ops_public_funnel_daily_clean_v1 cascade;

-- Verification (must return 0 rows before running step 2):
select c.relname, c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'ops_event_health_daily_v1',
    'ops_public_cta_segments_clean_v1',
    'ops_public_funnel_daily_clean_v1'
  );
