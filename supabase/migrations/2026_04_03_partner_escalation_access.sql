-- MSP secure view: snapshot row per scan + optional image path on scans

alter table public.scans
  add column if not exists submission_image_path text null;

create table if not exists public.partner_escalation_access (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  access_token uuid not null unique default gen_random_uuid(),
  client_note text null,
  raw_text text null,
  image_path text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint partner_escalation_access_scan_id_key unique (scan_id)
);

create index if not exists partner_escalation_access_token_idx
  on public.partner_escalation_access (access_token);

alter table public.partner_escalation_access enable row level security;

-- Private bucket: server uses service role for upload + signed URLs
insert into storage.buckets (id, name, public)
values ('submission-images', 'submission-images', false)
on conflict (id) do update set public = excluded.public;
