-- Shareable ScanScam decision reports (/r/{token}), 21-day access.
-- RLS enabled with no permissive policies: server code uses service role only.

create table if not exists public.pro_report_access (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  access_token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  report_kind text not null default 'decision_report',
  report_snapshot jsonb null
);

create index if not exists pro_report_access_token_idx
  on public.pro_report_access (access_token);

create index if not exists pro_report_access_expires_idx
  on public.pro_report_access (expires_at);

alter table public.pro_report_access enable row level security;
