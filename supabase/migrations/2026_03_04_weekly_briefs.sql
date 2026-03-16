-- public.weekly_briefs: one row per week_start; stores generated public-safe weekly brief.
-- Consumed by GET /api/brief/weekly and written by POST /api/internal/brief/generate-weekly (upsert on week_start).

create table if not exists public.weekly_briefs (
  id                  uuid primary key default gen_random_uuid(),
  week_start          date not null unique,
  generated_at        timestamptz not null default now(),
  status              text not null default 'published',
  scan_count          integer,
  top_narrative       text,
  top_channel         text,
  top_authority       text,
  top_payment_method  text,
  fraud_label         text,
  how_it_works        text,
  protection_tip      text,
  brief_json          jsonb not null,
  social_headline     text,
  social_summary      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Optional: if the project adopts updated_at triggers elsewhere, uncomment to keep updated_at in sync on UPDATE:
-- create or replace function public.set_updated_at()
-- returns trigger as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$ language plpgsql;
-- create trigger weekly_briefs_updated_at
--   before update on public.weekly_briefs
--   for each row execute function public.set_updated_at();

-- --------
-- Verification checklist (after applying migration):
-- [ ] Table public.weekly_briefs exists.
-- [ ] week_start is unique; one row per week.
-- [ ] brief_json is jsonb not null; GET /api/brief/weekly reads .brief_json from latest published row.
-- [ ] generate-weekly upsert uses onConflict: "week_start"; row has social_headline, social_summary, and all listed columns.
-- [ ] No RLS; app uses service role for read/write (or adjust if your pattern differs).
-- [ ] Optional: if using updated_at trigger, apply the commented block and re-run.
-- --------
