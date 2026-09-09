-- ScanScam Integrity v0.9
-- Collapse ACS tool-result settlement into one server-side database transaction.

create or replace function public.commit_integrity_runtime_execution(
  p_principal_id text,
  p_observer_client_id uuid,
  p_external_agent_id text,
  p_external_request_id uuid,
  p_external_session_id text,
  p_tool_name text,
  p_result_request_id uuid,
  p_exit_status text,
  p_output_hash text,
  p_duration_ms integer,
  p_executed_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  started_at timestamptz := clock_timestamp();
  binding jsonb;
  r public.integrity_runtime_executions%rowtype;
  a public.integrity_authorizations%rowtype;
  o public.integrity_action_observations%rowtype;
  commit_result jsonb;
  next_status text;
  receipt public.integrity_execution_receipts%rowtype;
begin
  if p_exit_status not in ('success','failure','timeout','blocked') then
    return jsonb_build_object('ok', false, 'error', 'acs_exit_status_invalid');
  end if;

  binding := public.resolve_integrity_runtime_binding(
    p_principal_id,
    p_observer_client_id,
    p_external_agent_id
  );

  if coalesce((binding->>'ok')::boolean, false) is not true then
    return binding || jsonb_build_object(
      'db_elapsed_ms',
      round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  select *
  into r
  from public.integrity_runtime_executions
  where principal_id = p_principal_id
    and observer_client_id = p_observer_client_id
    and external_request_id = p_external_request_id
    and external_agent_id = p_external_agent_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_execution_not_found',
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if r.external_session_id <> p_external_session_id
     or r.tool_name <> p_tool_name then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_result_context_mismatch',
      'runtime_execution_id', r.id,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if r.actor_client_id::text <> binding->>'actor_client_id' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_actor_binding_mismatch',
      'runtime_execution_id', r.id,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if r.status in ('succeeded','failed') then
    select *
    into receipt
    from public.integrity_execution_receipts
    where authorization_id = r.authorization_id;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'runtime_execution_id', r.id,
      'status', r.status,
      'authorization_id', r.authorization_id,
      'execution_receipt_id', receipt.id,
      'outcome', receipt.outcome,
      'baseline_version_after', receipt.baseline_version_after,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if r.status <> 'authorized' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_execution_not_authorized',
      'runtime_execution_id', r.id,
      'status', r.status,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  select *
  into a
  from public.integrity_authorizations
  where id = r.authorization_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_authorization_lookup_failed',
      'runtime_execution_id', r.id,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if a.client_id is null or a.client_id <> r.actor_client_id then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_authorization_client_mismatch',
      'runtime_execution_id', r.id,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  select *
  into o
  from public.integrity_action_observations
  where id = r.observation_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_observation_lookup_failed',
      'runtime_execution_id', r.id,
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  commit_result := public.commit_integrity_execution(
    r.authorization_id,
    r.actor_client_id,
    a.token_hash,
    a.action_hash,
    case when p_exit_status = 'success' then 'succeeded' else 'failed' end,
    case when p_exit_status = 'success' then o.state_snapshot else null end,
    case when p_exit_status = 'success' then o.state_hash else null end,
    'acs:' || p_external_request_id::text,
    coalesce(p_executed_at, now()),
    jsonb_build_object(
      'protocol', 'acs',
      'tool_call_result_request_id', p_result_request_id,
      'request_id_ref', p_external_request_id,
      'tool_name', p_tool_name,
      'exit_status', p_exit_status,
      'output_hash', p_output_hash,
      'duration_ms', p_duration_ms
    )
  );

  if coalesce((commit_result->>'ok')::boolean, false) then
    next_status := case when p_exit_status = 'success' then 'succeeded' else 'failed' end;
  else
    next_status := 'commit_rejected';
  end if;

  update public.integrity_runtime_executions
  set
    status = next_status,
    completed_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'request_id_ref', p_external_request_id,
      'tool_call_result_request_id', p_result_request_id,
      'exit_status', p_exit_status,
      'output_hash', p_output_hash,
      'commit', commit_result
    )
  where id = r.id;

  return jsonb_build_object(
    'ok', coalesce((commit_result->>'ok')::boolean, false),
    'runtime_execution_id', r.id,
    'status', next_status,
    'commit', commit_result,
    'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$$;

revoke execute on function public.commit_integrity_runtime_execution(
  text,uuid,text,uuid,text,text,uuid,text,text,integer,timestamptz
) from public, anon, authenticated;

grant execute on function public.commit_integrity_runtime_execution(
  text,uuid,text,uuid,text,text,uuid,text,text,integer,timestamptz
) to service_role;
