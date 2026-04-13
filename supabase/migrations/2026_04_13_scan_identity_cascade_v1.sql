-- Canonical scan identity hardening v1
-- Goals:
-- 1) Add explicit events.scan_id linkage to scans.id with cascade
-- 2) Backfill events.scan_id from events.context->>'scan_id' when valid UUID
-- 3) Ensure scan-linked child tables cascade on delete
-- 4) Persist partner attribution on escalation rows

-- ---------------------------------------------------------------------------
-- partner_escalation_access: persist partner slug for reporting
-- ---------------------------------------------------------------------------
alter table public.partner_escalation_access
  add column if not exists partner_slug text null;

create index if not exists partner_escalation_access_partner_slug_idx
  on public.partner_escalation_access (partner_slug);

-- ---------------------------------------------------------------------------
-- events: explicit scan foreign key (nullable)
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists scan_id uuid null;

-- Backfill from context JSON when scan_id looks like a UUID and references scans.id.
update public.events e
set scan_id = (e.context->>'scan_id')::uuid
where
  e.scan_id is null
  and e.context ? 'scan_id'
  and (e.context->>'scan_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.scans s
    where s.id = (e.context->>'scan_id')::uuid
  );

create index if not exists events_scan_id_idx
  on public.events (scan_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'events_scan_id_fkey'
      and c.conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_scan_id_fkey
      foreign key (scan_id)
      references public.scans(id)
      on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ensure cascade behavior on existing scan-linked child tables
-- ---------------------------------------------------------------------------
do $$
declare
  fk_name text;
  fk_confdeltype "char";
begin
  -- raw_messages(scan_id) -> scans(id) ON DELETE CASCADE
  select c.conname, c.confdeltype
  into fk_name, fk_confdeltype
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.conrelid = 'public.raw_messages'::regclass
    and c.confrelid = 'public.scans'::regclass
    and a.attname = 'scan_id'
  limit 1;

  if fk_name is null then
    alter table public.raw_messages
      add constraint raw_messages_scan_id_fkey
      foreign key (scan_id)
      references public.scans(id)
      on delete cascade;
  elsif fk_confdeltype <> 'c' then
    execute format('alter table public.raw_messages drop constraint %I', fk_name);
    alter table public.raw_messages
      add constraint raw_messages_scan_id_fkey
      foreign key (scan_id)
      references public.scans(id)
      on delete cascade;
  end if;
end $$;

do $$
declare
  fk_name text;
  fk_confdeltype "char";
begin
  -- partner_escalation_access(scan_id) -> scans(id) ON DELETE CASCADE
  select c.conname, c.confdeltype
  into fk_name, fk_confdeltype
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f'
    and c.conrelid = 'public.partner_escalation_access'::regclass
    and c.confrelid = 'public.scans'::regclass
    and a.attname = 'scan_id'
  limit 1;

  if fk_name is null then
    alter table public.partner_escalation_access
      add constraint partner_escalation_access_scan_id_fkey
      foreign key (scan_id)
      references public.scans(id)
      on delete cascade;
  elsif fk_confdeltype <> 'c' then
    execute format('alter table public.partner_escalation_access drop constraint %I', fk_name);
    alter table public.partner_escalation_access
      add constraint partner_escalation_access_scan_id_fkey
      foreign key (scan_id)
      references public.scans(id)
      on delete cascade;
  end if;
end $$;
