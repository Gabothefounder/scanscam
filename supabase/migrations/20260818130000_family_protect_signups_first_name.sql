-- Add required first_name to family_protect_signups (early-access iteration).

alter table public.family_protect_signups
  add column if not exists first_name text;

-- Backfill any pre-existing rows so NOT NULL can be applied safely.
update public.family_protect_signups
set first_name = 'Unknown'
where first_name is null or btrim(first_name) = '';

alter table public.family_protect_signups
  alter column first_name set not null;

alter table public.family_protect_signups
  drop constraint if exists family_protect_signups_first_name_len;

alter table public.family_protect_signups
  add constraint family_protect_signups_first_name_len
    check (
      char_length(first_name) <= 80
      and char_length(btrim(first_name)) > 0
    );
