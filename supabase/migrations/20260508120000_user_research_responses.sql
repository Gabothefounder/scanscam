-- Post-scan product-market-fit research responses (free-report unlock gate).
-- One row per scan; service-role only (RLS enabled, no permissive policies).

create table if not exists public.user_research_responses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  created_at timestamptz not null default now(),
  lang text null,
  source text not null default 'post_scan_full_report_gate',
  q1_situation text not null check (q1_situation in (
    'quick_check',
    'suspicious_message',
    'suspicious_call',
    'pressure_to_act',
    'already_acted',
    'checking_for_someone_else',
    'report_or_keep_proof',
    'work_or_client',
    'other'
  )),
  q2_problem_text text null,
  q3_help_options text[] not null default '{}',
  q3_help_other text null,
  q4_price_range text not null check (q4_price_range in (
    'free_only',
    'price_0_5',
    'price_5_10',
    'price_10_25',
    'around_50',
    'monthly_5_10',
    'monthly_10_20',
    'monthly_50_plus',
    'high_end_150_500',
    'not_sure'
  )),
  user_agent text null,
  referrer text null,
  constraint user_research_responses_scan_id_key unique (scan_id)
);

create index if not exists user_research_responses_created_at_idx
  on public.user_research_responses (created_at desc);

create index if not exists user_research_responses_q1_situation_idx
  on public.user_research_responses (q1_situation);

create index if not exists user_research_responses_q4_price_range_idx
  on public.user_research_responses (q4_price_range);

alter table public.user_research_responses enable row level security;
