-- Post-scan email opt-in leads (Decision Report unlock via /r/{token}).
-- Service-role only (RLS enabled, no permissive policies).

create table if not exists public.guide_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  scan_id uuid null references public.scans(id) on delete set null,
  access_token text null,
  risk_tier text null,
  lang text null,
  source text not null default 'post_scan_result',
  created_at timestamptz not null default now()
);

create index if not exists guide_leads_created_at_idx
  on public.guide_leads (created_at desc);

create index if not exists guide_leads_scan_id_idx
  on public.guide_leads (scan_id);

create index if not exists guide_leads_email_idx
  on public.guide_leads (email);

alter table public.guide_leads enable row level security;
