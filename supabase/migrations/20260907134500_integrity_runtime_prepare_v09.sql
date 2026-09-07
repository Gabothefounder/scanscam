-- ScanScam Integrity v0.9
-- Collapse runtime binding validation, observation persistence and v0.5
-- trusted-context resolution into one server-side preflight preparation RPC.

create or replace function public.prepare_integrity_runtime_preflight(
  p_principal_id text,
  p_observer_client_id uuid,
  p_external_agent_id text,
  p_protocol text,
  p_hook text,
  p_session_id text,
  p_step_id text,
  p_envelope jsonb,
  p_envelope_hash text,
  p_state_snapshot jsonb,
  p_state_hash text,
  p_causal_context text,
  p_expires_at timestamptz,
  p_attestation_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  started_at timestamptz := clock_timestamp();
  binding jsonb;
  context_result jsonb;
  observation_id uuid := gen_random_uuid();
begin
  if p_protocol <> 'acs' or p_hook <> 'steps/toolCallRequest' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_observation_protocol_invalid',
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if p_session_id is null or btrim(p_session_id) = ''
     or p_step_id is null or btrim(p_step_id) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_observation_identity_missing',
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if p_expires_at <= now()
     or p_expires_at > now() + interval '15 minutes' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_observation_expiry_invalid',
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  if p_envelope #>> '{tool,protocol}' <> 'acs'
     or p_envelope #>> '{tool,hook}' <> 'steps/toolCallRequest' then
    return jsonb_build_object(
      'ok', false,
      'error', 'runtime_envelope_protocol_mismatch',
      'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
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

  begin
    insert into public.integrity_action_observations(
      id,
      principal_id,
      observer_client_id,
      protocol,
      hook,
      session_id,
      step_id,
      envelope,
      envelope_hash,
      state_snapshot,
      state_hash,
      causal_context,
      expires_at,
      metadata
    )
    values(
      observation_id,
      p_principal_id,
      p_observer_client_id,
      p_protocol,
      p_hook,
      left(p_session_id, 240),
      left(p_step_id, 240),
      p_envelope,
      p_envelope_hash,
      p_state_snapshot,
      p_state_hash,
      nullif(left(coalesce(p_causal_context,''), 2400), ''),
      p_expires_at,
      jsonb_build_object(
        'privacy', 'raw_tool_arguments_not_persisted',
        'runtime_agent_id', p_external_agent_id
      )
    );
  exception
    when unique_violation then
      return jsonb_build_object(
        'ok', false,
        'error', 'integrity_observation_duplicate_step',
        'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
      );
  end;

  context_result := public.resolve_integrity_v05_context(
    p_principal_id,
    observation_id,
    coalesce(p_attestation_ids, '{}'::uuid[])
  );

  if coalesce((context_result->>'ok')::boolean, false) is not true then
    delete from public.integrity_action_observations where id = observation_id;
    return context_result || jsonb_build_object(
      'db_elapsed_ms',
      round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'binding', binding,
    'observation_id', observation_id,
    'context', context_result,
    'db_elapsed_ms', round(extract(epoch from (clock_timestamp() - started_at)) * 1000)
  );
end;
$$;

revoke execute on function public.prepare_integrity_runtime_preflight(
  text,uuid,text,text,text,text,text,jsonb,text,jsonb,text,text,timestamptz,uuid[]
) from public, anon, authenticated;

grant execute on function public.prepare_integrity_runtime_preflight(
  text,uuid,text,text,text,text,text,jsonb,text,jsonb,text,text,timestamptz,uuid[]
) to service_role;
