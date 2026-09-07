import { createClient } from "@supabase/supabase-js";
import type { IntegrityClientIdentity } from "./auth";
import {
  parseAcsToolCallRequest,
  parseAcsToolCallResult,
  guardianResponseForACS,
  simpleAcsFinalResponse,
  type ParsedAcsToolCallRequest,
  type ParsedAcsToolCallResult,
} from "./adapters/acs";
import { storeRuntimeObservation } from "./observer";
import { runIntegrityV05, type IntegrityV05RuntimeOptions } from "./v05";
import { persistIntegrityChallenge } from "./challenge";
import { actionEnvelopeToProposedAction } from "./action-envelope";
import { hashIntegrityValue } from "./canonical";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type RuntimeBinding = {
  binding_id: string;
  principal_id: string;
  external_agent_id: string;
  observer_client_id: string;
  actor_client_id: string;
  actor_name: string;
  actor_kind: "actor" | "hybrid";
  actor_scopes: Array<"preflight:write" | "commit:write" | "clients:manage" | "observe:write" | "attest:write">;
};

type RuntimeBindingFailure = { ok: false; error: string };

async function resolveRuntimeBinding(
  observer: IntegrityClientIdentity,
  externalAgentId: string
): Promise<RuntimeBinding> {
  const { data, error } = await supabase.rpc("resolve_integrity_runtime_binding", {
    p_principal_id: observer.principal_id,
    p_observer_client_id: observer.client_id,
    p_external_agent_id: externalAgentId,
  });

  if (error) throw new Error("runtime_binding_lookup_failed");
  const result = data as ({ ok: true } & RuntimeBinding) | RuntimeBindingFailure | null;
  if (!result) throw new Error("runtime_binding_lookup_failed");
  if (!result.ok) throw new Error(result.error);
  return result;
}

function actorIdentityFromBinding(binding: RuntimeBinding): IntegrityClientIdentity {
  return {
    client_id: binding.actor_client_id,
    principal_id: binding.principal_id,
    name: binding.actor_name,
    kind: binding.actor_kind,
    scopes: binding.actor_scopes,
    credential_id: "runtime-binding",
  };
}

async function recordAuthorizedRuntimeExecution(input: {
  parsed: ParsedAcsToolCallRequest;
  observer: IntegrityClientIdentity;
  actor: IntegrityClientIdentity;
  observation_id: string;
  authorization_id: string;
  action_hash: string;
  preflight_duration_ms: number;
  semantic_ran: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("integrity_runtime_executions")
    .insert({
      principal_id: actor.principal_id,
      protocol: "acs",
      external_request_id: input.parsed.request_id,
      observer_client_id: observer.client_id,
      actor_client_id: actor.client_id,
      observation_id: input.observation_id,
      authorization_id: input.authorization_id,
      action_hash: input.action_hash,
      disposition: "ALLOW",
      status: "authorized",
      preflight_duration_ms: Math.max(0, Math.round(input.preflight_duration_ms)),
      semantic_ran: input.semantic_ran,
      metadata: {
        acs_version: input.parsed.acs_version,
        session_id: input.parsed.session_id,
        turn_id: input.parsed.turn_id ?? null,
        agent_id: input.parsed.agent_id,
      },
    });

  if (error) {
    if (error.code === "23505") throw new Error("runtime_request_already_authorized");
    throw new Error("runtime_execution_record_failed");
  }
}

export async function processAcsToolCallRequest(input: {
  body: unknown;
  observer: IntegrityClientIdentity;
  semantic?: IntegrityV05RuntimeOptions["semanticAnalyzer"];
}): Promise<Record<string, unknown>> {
  const started = performance.now();
  const parsed = parseAcsToolCallRequest(input.body);
  const binding = await resolveRuntimeBinding(input.observer, parsed.agent_id);
  const actor = actorIdentityFromBinding(binding);

  const observation = await storeRuntimeObservation(parsed.observed, input.observer);
  const result = await runIntegrityV05(
    { observation_id: observation.id },
    actor,
    input.semantic ? { semanticAnalyzer: input.semantic } : undefined
  );
  const challenge = await persistIntegrityChallenge(result, actor);
  const duration = performance.now() - started;

  if (result.disposition === "ALLOW" && result.authorization) {
    const actionHash = hashIntegrityValue(actionEnvelopeToProposedAction(result.action));
    await recordAuthorizedRuntimeExecution({
      parsed,
      observer: input.observer,
      actor,
      observation_id: observation.id,
      authorization_id: result.authorization.id,
      action_hash: actionHash,
      preflight_duration_ms: duration,
      semantic_ran: result.trust.semantic.ran,
    });
  }

  return guardianResponseForACS({
    request: parsed,
    result,
    challenge_id: challenge?.id ?? null,
    evaluation_duration_ms: duration,
  });
}

async function loadRuntimeExecution(
  observer: IntegrityClientIdentity,
  parsed: ParsedAcsToolCallResult
): Promise<{
  id: string;
  principal_id: string;
  actor_client_id: string;
  authorization_id: string;
  observation_id: string;
  status: string;
}> {
  const { data, error } = await supabase
    .from("integrity_runtime_executions")
    .select("id,principal_id,actor_client_id,authorization_id,observation_id,status")
    .eq("principal_id", observer.principal_id)
    .eq("observer_client_id", observer.client_id)
    .eq("external_request_id", parsed.request_id_ref)
    .maybeSingle();

  if (error) throw new Error("runtime_execution_lookup_failed");
  if (!data) throw new Error("runtime_execution_not_found");
  return data as {
    id: string;
    principal_id: string;
    actor_client_id: string;
    authorization_id: string;
    observation_id: string;
    status: string;
  };
}

async function commitAcsRuntimeExecution(input: {
  parsed: ParsedAcsToolCallResult;
  observer: IntegrityClientIdentity;
  runtime: Awaited<ReturnType<typeof loadRuntimeExecution>>;
}): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const { data: authorization, error: authError } = await supabase
    .from("integrity_authorizations")
    .select("id,client_id,token_hash,action_hash,status")
    .eq("id", input.runtime.authorization_id)
    .single();

  if (authError || !authorization) throw new Error("runtime_authorization_lookup_failed");
  if (authorization.client_id !== input.runtime.actor_client_id) {
    throw new Error("runtime_authorization_client_mismatch");
  }

  const { data: observation, error: observationError } = await supabase
    .from("integrity_action_observations")
    .select("state_snapshot,state_hash")
    .eq("id", input.runtime.observation_id)
    .single();

  if (observationError || !observation) throw new Error("runtime_observation_lookup_failed");

  const succeeded = input.parsed.exit_status === "success";

  const { data, error } = await supabase.rpc("commit_integrity_execution", {
    p_authorization_id: input.runtime.authorization_id,
    p_client_id: input.runtime.actor_client_id,
    p_token_hash: authorization.token_hash,
    p_action_hash: authorization.action_hash,
    p_outcome: succeeded ? "succeeded" : "failed",
    p_resulting_state: succeeded ? observation.state_snapshot ?? null : null,
    p_resulting_state_hash: succeeded ? observation.state_hash ?? null : null,
    p_external_execution_id: `acs:${input.parsed.request_id_ref}`,
    p_executed_at: input.parsed.timestamp,
    p_metadata: {
      protocol: "acs",
      tool_call_result_request_id: input.parsed.request_id,
      request_id_ref: input.parsed.request_id_ref,
      tool_name: input.parsed.tool_name,
      exit_status: input.parsed.exit_status,
      output_hash: input.parsed.output_hash,
      duration_ms: input.parsed.duration_ms ?? null,
    },
  });

  if (error) throw new Error("runtime_commit_rpc_failed");
  return (data ?? { ok: false, error: "runtime_commit_empty" }) as {
    ok: boolean;
    error?: string;
    [key: string]: unknown;
  };
}

export async function processAcsToolCallResult(input: {
  body: unknown;
  observer: IntegrityClientIdentity;
}): Promise<Record<string, unknown>> {
  const started = performance.now();
  const parsed = parseAcsToolCallResult(input.body);
  await resolveRuntimeBinding(input.observer, parsed.agent_id);

  let runtime: Awaited<ReturnType<typeof loadRuntimeExecution>>;
  try {
    runtime = await loadRuntimeExecution(input.observer, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "runtime_execution_not_found";
    return simpleAcsFinalResponse({
      request: parsed,
      decision: "deny",
      reasoning: "ScanScam has no matching pre-execution authorization for this tool result.",
      reason_codes: ["scanscam_untracked_tool_execution", message],
      policy_data: {
        scanscam: {
          integrity_version: "0.7",
          request_id_ref: parsed.request_id_ref,
        },
      },
      evaluation_duration_ms: performance.now() - started,
    });
  }

  if (runtime.status !== "authorized") {
    const { data: receipt } = await supabase
      .from("integrity_execution_receipts")
      .select("id,outcome,baseline_version_after")
      .eq("authorization_id", runtime.authorization_id)
      .maybeSingle();

    return simpleAcsFinalResponse({
      request: parsed,
      decision: runtime.status === "succeeded" || runtime.status === "failed" ? "allow" : "deny",
      reasoning: "This ACS tool result has already been processed by ScanScam.",
      reason_codes: ["scanscam_runtime_result_replayed"],
      policy_data: {
        scanscam: {
          integrity_version: "0.7",
          runtime_execution_id: runtime.id,
          receipt: receipt ?? null,
        },
      },
      evaluation_duration_ms: performance.now() - started,
    });
  }

  const committed = await commitAcsRuntimeExecution({
    parsed,
    observer: input.observer,
    runtime,
  });

  const nextStatus =
    committed.ok
      ? parsed.exit_status === "success"
        ? "succeeded"
        : "failed"
      : "commit_rejected";

  await supabase
    .from("integrity_runtime_executions")
    .update({
      status: nextStatus,
      completed_at: new Date().toISOString(),
      metadata: {
        request_id_ref: parsed.request_id_ref,
        tool_call_result_request_id: parsed.request_id,
        exit_status: parsed.exit_status,
        output_hash: parsed.output_hash,
        commit: committed,
      },
    })
    .eq("id", runtime.id)
    .eq("status", "authorized");

  const duration = performance.now() - started;

  if (!committed.ok) {
    return simpleAcsFinalResponse({
      request: parsed,
      decision: "deny",
      reasoning: "The tool executed, but ScanScam rejected the execution Commit because the authorization context was no longer valid.",
      reason_codes: ["scanscam_execution_commit_rejected", `scanscam_${String(committed.error ?? "unknown")}`],
      policy_data: {
        scanscam: {
          integrity_version: "0.7",
          runtime_execution_id: runtime.id,
          commit: committed,
        },
      },
      evaluation_duration_ms: duration,
    });
  }

  return simpleAcsFinalResponse({
    request: parsed,
    decision: "allow",
    reasoning: "ScanScam accepted the tool execution result and settled the bound execution authorization.",
    reason_codes: ["scanscam_execution_committed"],
    policy_data: {
      scanscam: {
        integrity_version: "0.7",
        runtime_execution_id: runtime.id,
        commit: committed,
      },
    },
    evaluation_duration_ms: duration,
  });
}
