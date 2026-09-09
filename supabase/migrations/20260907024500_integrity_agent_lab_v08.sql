-- ScanScam Integrity v0.8
-- Agent lab telemetry for controlled consequential-action experiments.

create table if not exists public.integrity_runtime_experiments (
  run_id uuid primary key default gen_random_uuid(),
  scenario text not null,
  principal_id text not null,
  agent_model text not null,
  agent_request_id text,
  agent_input_tokens integer,
  agent_output_tokens integer,
  agent_total_tokens integer,
  agent_estimated_cost_usd numeric(14,8),
  guardian_decision text,
  guardian_disposition text,
  guardian_duration_ms integer,
  guardian_semantic_ran boolean not null default false,
  guardian_semantic_model text,
  guardian_semantic_input_tokens integer,
  guardian_semantic_output_tokens integer,
  guardian_semantic_total_tokens integer,
  guardian_semantic_estimated_cost_usd numeric(14,8),
  proposal_duration_ms integer,
  completion_duration_ms integer,
  tool_duration_ms integer,
  commit_duration_ms integer,
  total_duration_ms integer,
  executed boolean not null default false,
  committed boolean not null default false,
  receipt_outcome text,
  prompt_hash text not null,
  action_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integrity_runtime_experiments_created_idx
  on public.integrity_runtime_experiments(created_at desc);

create index if not exists integrity_runtime_experiments_scenario_idx
  on public.integrity_runtime_experiments(scenario, created_at desc);

alter table public.integrity_runtime_experiments enable row level security;

revoke all on table public.integrity_runtime_experiments from anon, authenticated;
grant select, insert, update, delete
  on table public.integrity_runtime_experiments
  to service_role;
