-- ScanScam Integrity v0.7
-- ACS runtime bindings and execution settlement.
-- Prerequisites: integrity_clients, integrity_action_observations,
-- integrity_authorizations and the v0.3+ execution receipt functions.

create table if not exists public.integrity_runtime_bindings (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  protocol text not null default 'acs'
    check (protocol in ('acs')),
  external_agent_id text not null,
  observer_client_id uuid not null references public.integrity_clients(id),
  actor_client_id uuid not null references public.integrity_clients(id),
  status text not null default 'active'
    check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists integrity_runtime_bindings_active_agent_idx
  on public.integrity_runtime_bindings(principal_id, protocol, external_agent_id)
  where status = 'active';

create index if not exists integrity_runtime_bindings_observer_idx
  on public.integrity_runtime_bindings(observer_client_id, protocol, status);

create index if not exists integrity_runtime_bindings_actor_idx
  on public.integrity_runtime_bindings(actor_client_id, status);

alter table public.integrity_runtime_bindings enable row level security;

revoke all on table public.integrity_runtime_bindings from anon, authenticated;
grant select, insert, update, delete
  on table public.integrity_runtime_bindings
  to service_role;

create table if not exists public.integrity_runtime_executions (
  id uuid primary key default gen_random_uuid(),
  principal_id text not null,
  protocol text not null default 'acs'
    check (protocol in ('acs')),
  external_request_id uuid not null,
  external_agent_id text not null,
  external_session_id text not null,
  tool_name text not null,
  observer_client_id uuid not null references public.integrity_clients(id),
  actor_client_id uuid not null references public.integrity_clients(id),
  observation_id uuid not null references public.integrity_action_observations(id),
  authorization_id uuid not null unique references public.integrity_authorizations(id),
  action_hash text not null,
  disposition text not null default 'ALLOW',
  status text not null default 'authorized'
    check (status in ('authorized','succeeded','failed','commit_rejected')),
  preflight_duration_ms integer not null default 0
    check (preflight_duration_ms >= 0),
  semantic_ran boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Make the migration safe against the short-lived pre-hardening v0.7 table.
alter table public.integrity_runtime_executions
  add column if not exists external_agent_id text,
  add column if not exists external_session_id text,
  add column if not exists tool_name text;

-- No pre-v0.7 production rows should exist. If a development database contains
-- legacy rows, populate these fields before applying the NOT NULL hardening.
alter table public.integrity_runtime_executions
  alter column external_agent_id set not null,
  alter column external_session_id set not null,
  alter column tool_name set not null;

create unique index if not exists integrity_runtime_executions_request_idx
  on public.integrity_runtime_executions(observer_client_id, external_request_id);

create index if not exists integrity_runtime_executions_principal_idx
  on public.integrity_runtime_executions(principal_id, created_at desc);

create index if not exists integrity_runtime_executions_agent_idx
  on public.integrity_runtime_executions(
    principal_id,
    observer_client_id,
    external_agent_id,
    created_at desc
  );

create index if not exists integrity_runtime_executions_actor_idx
  on public.integrity_runtime_executions(actor_client_id);

create index if not exists integrity_runtime_executions_observation_idx
  on public.integrity_runtime_executions(observation_id);

alter table public.integrity_runtime_executions enable row level security;

revoke all on table public.integrity_runtime_executions from anon, authenticated;
grant select, insert, update, delete
  on table public.integrity_runtime_executions
  to service_role;

create or replace function public.resolve_integrity_runtime_binding(
  p_principal_id text,
  p_observer_client_id uuid,
  p_external_agent_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b record;
begin
  select
    rb.id as binding_id,
    rb.principal_id,
    rb.external_agent_id,
    rb.observer_client_id,
    rb.actor_client_id,
    observer.kind as observer_kind,
    observer.status as observer_status,
    observer.revoked_at as observer_revoked_at,
    actor.name as actor_name,
    actor.kind as actor_kind,
    actor.scopes as actor_scopes,
    actor.status as actor_status,
    actor.revoked_at as actor_revoked_at
  into b
  from public.integrity_runtime_bindings rb
  join public.integrity_clients observer
    on observer.id = rb.observer_client_id
  join public.integrity_clients actor
    on actor.id = rb.actor_client_id
  where rb.principal_id = p_principal_id
    and rb.observer_client_id = p_observer_client_id
    and rb.external_agent_id = p_external_agent_id
    and rb.protocol = 'acs'
    and rb.status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_binding_not_found'
    );
  end if;

  if b.observer_status <> 'active'
     or b.observer_revoked_at is not null
     or b.observer_kind not in ('observer','hybrid') then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_observer_inactive'
    );
  end if;

  if b.actor_status <> 'active'
     or b.actor_revoked_at is not null
     or b.actor_kind not in ('actor','hybrid') then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_actor_inactive'
    );
  end if;

  if not ('preflight:write' = any(b.actor_scopes))
     or not ('commit:write' = any(b.actor_scopes)) then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_actor_scope_invalid'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'binding_id', b.binding_id,
    'principal_id', b.principal_id,
    'external_agent_id', b.external_agent_id,
    'observer_client_id', b.observer_client_id,
    'actor_client_id', b.actor_client_id,
    'actor_name', b.actor_name,
    'actor_kind', b.actor_kind,
    'actor_scopes', to_jsonb(b.actor_scopes)
  );
end;
$$;

revoke execute
  on function public.resolve_integrity_runtime_binding(text,uuid,text)
  from public, anon, authenticated;

grant execute
  on function public.resolve_integrity_runtime_binding(text,uuid,text)
  to service_role;
