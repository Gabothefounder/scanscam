-- Family Protect early-access smoke-test signups.
-- Service-role writes from Next.js only (RLS enabled, no permissive policies).

create table if not exists public.family_protect_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  who_protect text not null check (who_protect in (
    'parent',
    'grandparent',
    'partner',
    'family',
    'self',
    'other'
  )),
  concern_text text null,
  lang text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_term text null,
  utm_content text null,
  gclid text null,
  referrer text null,
  landing_path text null,
  contact_consent_at timestamptz not null,
  constraint family_protect_signups_email_len
    check (char_length(email) <= 254),
  constraint family_protect_signups_concern_len
    check (concern_text is null or char_length(concern_text) <= 2000),
  constraint family_protect_signups_lang_chk
    check (lang is null or lang in ('en', 'fr'))
);

create index if not exists family_protect_signups_created_at_idx
  on public.family_protect_signups (created_at desc);

create index if not exists family_protect_signups_email_idx
  on public.family_protect_signups (email);

create index if not exists family_protect_signups_who_protect_idx
  on public.family_protect_signups (who_protect);

alter table public.family_protect_signups enable row level security;
