-- Add columns to scans
alter table public.scans
 add column if not exists intel_features jsonb not null default '{}'::jsonb,
 add column if not exists raw_opt_in boolean not null default false,
 add column if not exists country_code text null,
 add column if not exists region_code text null,
 add column if not exists city text null;

-- Create raw_messages table
create table if not exists public.raw_messages (
 id uuid primary key default gen_random_uuid(),
 scan_id uuid not null references public.scans(id) on delete cascade,
 message_text text not null,
 source text null,
 created_at timestamptz not null default now(),
 delete_after timestamptz not null
);

create index if not exists raw_messages_scan_id_idx on public.raw_messages(scan_id);
create index if not exists raw_messages_delete_after_idx on public.raw_messages(delete_after);

-- Helper function
create or replace function public.compute_delete_after_30d()
returns timestamptz
language sql
stable
as $$
 select now() + interval '30 days';
$$;

-- Delete job function (cron target)
create or replace function public.delete_expired_raw_messages()
returns void
language plpgsql
as $$
begin
 delete from public.raw_messages
 where delete_after < now();
end;
$$;
