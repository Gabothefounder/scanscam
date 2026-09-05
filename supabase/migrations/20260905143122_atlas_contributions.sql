create table if not exists public.atlas_contributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null unique,
  scan_id uuid null references public.scans(id) on delete set null,
  lang text not null check (lang in ('en','fr')),
  entry_mode text not null check (entry_mode in ('scan','lived','helping','learn')),
  source text not null default 'atlas_journey',
  selected_signals jsonb not null default '{}'::jsonb,
  action_ids text[] not null default '{}'::text[],
  consent_version text not null,
  consented_at timestamptz not null,
  share_scope text not null default 'anonymous_pattern'
    check (share_scope = 'anonymous_pattern'),
  private_text_included boolean not null default false
    check (private_text_included = false)
);

comment on table public.atlas_contributions is
  'Explicitly consented, structured Atlas patterns only. Never store pasted messages, free-text notes, evidence details, or private ledger contents here.';

alter table public.atlas_contributions enable row level security;

revoke all on table public.atlas_contributions from anon, authenticated;
grant select, insert on table public.atlas_contributions to service_role;

create index if not exists atlas_contributions_created_at_idx
  on public.atlas_contributions (created_at desc);

create index if not exists atlas_contributions_signals_gin_idx
  on public.atlas_contributions using gin (selected_signals);
