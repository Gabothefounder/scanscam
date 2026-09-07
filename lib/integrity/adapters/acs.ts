import type { ObservedToolCallInput } from "../action-envelope";
import type { IntegrityV05Result } from "../v05";
import type { Primitive } from "../preflight";
import { hashIntegrityValue } from "../canonical";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isJsonRpcId(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function toPrimitive(value: unknown, depth = 0): Primitive {
  if (depth > 8) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => toPrimitive(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, Primitive> = {};
    for (const [key, item] of Object.entries(value as AnyRecord).slice(0, 100)) {
      out[key] = toPrimitive(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

function unwrapAcsArguments(value: unknown): Record<string, Primitive> {
  const args = record(value);
  if (!args) throw new Error("acs_arguments_required");

  const out: Record<string, Primitive> = {};
  for (const [key, wrapper] of Object.entries(args).slice(0, 100)) {
    const wrapped = record(wrapper);
    if (!wrapped || !("value" in wrapped)) {
      throw new Error("acs_argument_wrapper_invalid");
    }
    out[key] = toPrimitive(wrapped.value);
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AcsRequestContext = {
  jsonrpc_id: string | number;
  acs_version: string;
  request_id: string;
  timestamp: string;
  agent_id: string;
  session_id: string;
  turn_id?: string;
};

export type ParsedAcsToolCallRequest = AcsRequestContext & {
  observed: ObservedToolCallInput;
};

export type ParsedAcsToolCallResult = AcsRequestContext & {
  request_id_ref: string;
  tool_name: string;
  exit_status: "success" | "failure" | "timeout" | "blocked";
  duration_ms?: number;
  output_hash: string;
};

export function parseAcsToolCallRequest(value: unknown): ParsedAcsToolCallRequest {
  const root = record(value);
  if (!root) throw new Error("acs_request_invalid");
  if (root.jsonrpc !== "2.0") throw new Error("acs_jsonrpc_invalid");
  if (!isJsonRpcId(root.id)) throw new Error("acs_jsonrpc_id_invalid");
  if (root.method !== "steps/toolCallRequest") throw new Error("acs_tool_call_request_required");

  const params = record(root.params);
  if (!params) throw new Error("acs_params_required");

  const acsVersion = requiredString(params.acs_version, "acs_version_required");
  const requestId = requiredString(params.request_id, "acs_request_id_required");
  if (!UUID_RE.test(requestId)) throw new Error("acs_request_id_invalid");

  const timestamp = requiredString(params.timestamp, "acs_timestamp_required");
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("acs_timestamp_invalid");

  const metadata = record(params.metadata);
  if (!metadata) throw new Error("acs_metadata_required");
  const agentId = requiredString(metadata.agent_id, "acs_agent_id_required");
  const sessionId = requiredString(metadata.session_id, "acs_session_id_required");

  const payload = record(params.payload);
  if (!payload) throw new Error("acs_payload_required");
  const tool = record(payload.tool);
  if (!tool) throw new Error("acs_tool_required");
  const toolName = requiredString(tool.name, "acs_tool_name_required");

  const args = unwrapAcsArguments(payload.arguments);
  const operation = optionalString(payload.operation);
  const capability = optionalString(payload.capability);
  const rawCommand = optionalString(payload.raw_command);
  const intent = record(payload.intent);
  const goal = optionalString(intent?.goal);
  const intentDescription = optionalString(intent?.description);

  const acsFacts: Record<string, Primitive> = {};
  if (operation) acsFacts.operation = operation;
  if (capability) acsFacts.capability = capability;
  if (rawCommand) acsFacts.raw_command_hash = hashIntegrityValue(rawCommand);

  return {
    jsonrpc_id: root.id,
    acs_version: acsVersion,
    request_id: requestId,
    timestamp,
    agent_id: agentId,
    session_id: sessionId,
    turn_id: optionalString(metadata.turn_id),
    observed: {
      protocol: "acs",
      hook: "steps/toolCallRequest",
      session_id: sessionId,
      step_id: requestId,
      goal,
      causal_context: intentDescription,
      tool: {
        name: toolName,
        server: optionalString(tool.provider),
        description: [capability, operation].filter(Boolean).join(" · ") || undefined,
        schema_hash: optionalString(tool.version),
      },
      arguments: {
        ...args,
        __acs: acsFacts,
      },
    },
  };
}

export function parseAcsToolCallResult(value: unknown): ParsedAcsToolCallResult {
  const root = record(value);
  if (!root) throw new Error("acs_request_invalid");
  if (root.jsonrpc !== "2.0") throw new Error("acs_jsonrpc_invalid");
  if (!isJsonRpcId(root.id)) throw new Error("acs_jsonrpc_id_invalid");
  if (root.method !== "steps/toolCallResult") throw new Error("acs_tool_call_result_required");

  const params = record(root.params);
  if (!params) throw new Error("acs_params_required");

  const acsVersion = requiredString(params.acs_version, "acs_version_required");
  const requestId = requiredString(params.request_id, "acs_request_id_required");
  if (!UUID_RE.test(requestId)) throw new Error("acs_request_id_invalid");

  const timestamp = requiredString(params.timestamp, "acs_timestamp_required");
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("acs_timestamp_invalid");

  const metadata = record(params.metadata);
  if (!metadata) throw new Error("acs_metadata_required");
  const agentId = requiredString(metadata.agent_id, "acs_agent_id_required");
  const sessionId = requiredString(metadata.session_id, "acs_session_id_required");

  const payload = record(params.payload);
  if (!payload) throw new Error("acs_payload_required");
  const tool = record(payload.tool);
  if (!tool) throw new Error("acs_tool_required");
  const toolName = requiredString(tool.name, "acs_tool_name_required");

  const requestRef = requiredString(payload.request_id_ref, "acs_request_id_ref_required");
  if (!UUID_RE.test(requestRef)) throw new Error("acs_request_id_ref_invalid");

  const status = requiredString(payload.exit_status, "acs_exit_status_required");
  if (!["success", "failure", "timeout", "blocked"].includes(status)) {
    throw new Error("acs_exit_status_invalid");
  }

  const outputs = Array.isArray(payload.outputs) ? payload.outputs : null;
  if (!outputs) throw new Error("acs_outputs_required");

  const outputValues = outputs.slice(0, 100).map((item) => {
    const wrapper = record(item);
    if (!wrapper || !("value" in wrapper)) throw new Error("acs_output_wrapper_invalid");
    return toPrimitive(wrapper.value);
  });

  const duration =
    typeof payload.duration_ms === "number" && Number.isFinite(payload.duration_ms)
      ? Math.max(0, Math.floor(payload.duration_ms))
      : undefined;

  return {
    jsonrpc_id: root.id,
    acs_version: acsVersion,
    request_id: requestId,
    timestamp,
    agent_id: agentId,
    session_id: sessionId,
    turn_id: optionalString(metadata.turn_id),
    request_id_ref: requestRef,
    tool_name: toolName,
    exit_status: status as ParsedAcsToolCallResult["exit_status"],
    duration_ms: duration,
    output_hash: hashIntegrityValue(outputValues),
  };
}

function acsDecision(result: IntegrityV05Result): "allow" | "deny" | "ask" | "defer" {
  switch (result.disposition) {
    case "ALLOW": return "allow";
    case "DENY": return "deny";
    case "APPROVAL_REQUIRED": return "ask";
    case "CHALLENGE": return "defer";
  }
}

function reasonCodes(result: IntegrityV05Result): string[] {
  return [...new Set(
    result.signals
      .filter((signal) => signal.severity !== "info")
      .map((signal) => `scanscam_${signal.code.toLowerCase()}`)
      .slice(0, 24)
  )];
}

export function guardianResponseForACS(input: {
  request: AcsRequestContext;
  result: IntegrityV05Result;
  challenge_id?: string | null;
  evaluation_duration_ms: number;
}): Record<string, unknown> {
  const { request, result } = input;
  const decision = acsDecision(result);

  const response: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: request.jsonrpc_id,
    result: {
      type: "final",
      acs_version: request.acs_version,
      request_id: request.request_id,
      decision,
      reasoning:
        result.disposition === "ALLOW"
          ? "ScanScam Integrity Guardian allowed the observed action under the principal's current policy and trusted context."
          : result.disposition === "APPROVAL_REQUIRED"
            ? "The action is understood, but the principal's policy requires explicit approval before execution."
            : result.disposition === "CHALLENGE"
              ? "The Guardian needs additional trusted context or independent evidence before it can allow execution."
              : "The principal's active policy denies this action.",
      reason_codes: reasonCodes(result),
      policy_references: [{
        policy_id: "scanscam-principal-mandate",
        policy_version: String(result.trust.mandate.version),
        policy_name: "ScanScam Principal Mandate",
      }],
      policy_data: {
        scanscam: {
          integrity_version: result.version,
          disposition: result.disposition,
          intervention_score: result.intervention_score,
          observation_id: result.trust.observation_id,
          challenge_id: input.challenge_id ?? null,
          authorization_id: result.authorization?.id ?? null,
          required_controls: result.required_controls,
          value_guard: result.value_guard,
          semantic: {
            required: result.trust.semantic.required,
            ran: result.trust.semantic.ran,
            model: result.trust.semantic.model ?? null,
            request_id: result.trust.semantic.request_id ?? null,
            input_tokens: result.trust.semantic.input_tokens ?? null,
            output_tokens: result.trust.semantic.output_tokens ?? null,
            total_tokens: result.trust.semantic.total_tokens ?? null,
            estimated_cost_usd: result.trust.semantic.estimated_cost_usd ?? null,
          },
          acs_profile: "v0.1.0-schema-aligned-preview",
          acs_core_signed: false,
        },
      },
      metadata: {
        evaluator: result.trust.semantic.ran ? "composite" : "deterministic",
        evaluator_version: "scanscam-integrity-0.5",
        evaluation_duration_ms: Math.max(0, Math.round(input.evaluation_duration_ms)),
        ...(result.trust.semantic.ran && result.trust.semantic.model
          ? { model_id: result.trust.semantic.model }
          : {}),
      },
    },
  };

  const resultBody = response.result as Record<string, unknown>;

  if (decision === "ask") {
    resultBody.ask_details = {
      approver: {
        type: "human",
        id: "principal",
      },
      question: "Approve this action for this request?",
      context: result.required_controls.length
        ? `Required controls: ${result.required_controls.join(", ")}`
        : "The principal policy requires explicit approval.",
      options: ["approve", "deny"],
      timeout_seconds: 300,
      timeout_disposition: "deny",
    };
  }

  if (decision === "defer") {
    const hasEvidenceRequirement = result.challenge_requirements.some(
      (requirement) => requirement.kind === "attestation"
    );
    const semanticUnavailable = result.signals.some(
      (signal) => signal.code === "SEMANTIC_REQUIRED_UNAVAILABLE"
    );

    resultBody.defer_details = {
      reason: hasEvidenceRequirement
        ? "pending_dependency"
        : semanticUnavailable
          ? "low_confidence"
          : "insufficient_context",
      resolution_method: "additional_context",
      resolution_timeout_ms: 600_000,
      timeout_decision: "deny",
      required_context: result.challenge_requirements
        .map((requirement) => requirement.claim ?? requirement.id)
        .slice(0, 20),
    };
  }

  return response;
}

export function simpleAcsFinalResponse(input: {
  request: AcsRequestContext;
  decision: "allow" | "deny";
  reasoning: string;
  reason_codes?: string[];
  policy_data?: Record<string, unknown>;
  evaluation_duration_ms?: number;
}): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id: input.request.jsonrpc_id,
    result: {
      type: "final",
      acs_version: input.request.acs_version,
      request_id: input.request.request_id,
      decision: input.decision,
      reasoning: input.reasoning,
      reason_codes: input.reason_codes ?? [],
      policy_data: input.policy_data ?? {},
      metadata: {
        evaluator: "deterministic",
        evaluator_version: "scanscam-integrity-runtime-0.7",
        evaluation_duration_ms: Math.max(0, Math.round(input.evaluation_duration_ms ?? 0)),
      },
    },
  };
}
