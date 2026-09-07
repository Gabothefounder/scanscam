import type { ObservedToolCallInput } from "../action-envelope";
import type { IntegrityV05Result } from "../v05";
import type { Primitive } from "../preflight";

type AnyRecord = Record<string, any>;

function record(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function primitiveRecord(value: unknown): Record<string, Primitive> {
  return record(value) ? (value as Record<string, Primitive>) : {};
}

/**
 * Public-preview ACS adapter.
 *
 * ACS is evolving. Keep ScanScam's Guardian core protocol-neutral and isolate
 * schema drift here. This adapter intentionally accepts a small set of common
 * JSON-RPC envelope shapes around the ACS toolCallRequest hook.
 */
export function observedToolCallFromACS(value: unknown): ObservedToolCallInput {
  const root = record(value);
  if (!root) throw new Error("acs_request_invalid");

  const method = firstString(root.method);
  if (!method || !/toolCallRequest$/i.test(method)) {
    throw new Error("acs_tool_call_request_required");
  }

  const params = record(root.params) ?? {};
  const request = record(params.request) ?? {};
  const context = record(params.context) ?? record(request.context) ?? {};
  const session = record(params.session) ?? record(context.session) ?? {};
  const step = record(params.step) ?? record(context.step) ?? {};
  const tool =
    record(params.tool) ??
    record(request.tool) ??
    record(params.action)?.tool ??
    {};

  const toolName = firstString(
    tool.name,
    tool.id,
    params.tool_name,
    request.tool_name
  );
  if (!toolName) throw new Error("acs_tool_name_required");

  const args =
    record(params.arguments) ??
    record(params.input) ??
    record(request.arguments) ??
    record(request.input) ??
    record(tool.arguments) ??
    {};

  return {
    protocol: "acs",
    hook: "toolCallRequest",
    session_id: firstString(params.session_id, session.id, context.session_id),
    step_id: firstString(params.step_id, step.id, context.step_id),
    goal: firstString(
      params.goal,
      context.goal,
      context.task,
      request.goal
    ),
    causal_context: firstString(
      params.causal_context,
      context.causal_context,
      context.reasoning_summary,
      context.rationale,
      request.causal_context
    ),
    tool: {
      name: toolName,
      server: firstString(tool.server, tool.server_url, tool.origin, params.tool_server),
      description: firstString(tool.description, params.tool_description),
      schema_hash: firstString(tool.schema_hash, params.tool_schema_hash),
    },
    arguments: primitiveRecord(args),
  };
}

export function guardianResponseForACS(
  result: IntegrityV05Result,
  challengeId?: string | null
): {
  decision: "permit" | "deny";
  reason: string;
  metadata: Record<string, unknown>;
} {
  const permit = result.disposition === "ALLOW";

  return {
    decision: permit ? "permit" : "deny",
    reason:
      result.disposition === "ALLOW"
        ? "ScanScam Integrity Guardian permitted the observed action."
        : `ScanScam Integrity Guardian requires ${result.disposition.toLowerCase()} before execution.`,
    metadata: {
      scanscam_integrity_version: result.version,
      disposition: result.disposition,
      intervention_score: result.intervention_score,
      challenge_id: challengeId ?? null,
      required_controls: result.required_controls,
    },
  };
}
