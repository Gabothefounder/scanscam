import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Primitive, ProposedAction } from "./preflight";
import type { TrustedPreflightRequest, TrustedPreflightResult } from "./trusted";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

function canonicalize(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

export function hashIntegrityValue(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalize(value)).digest("hex");
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type AuthorizationReceipt = {
  id: string;
  token: string;
  expires_at: string;
  action_hash: string;
  subject_id: string | null;
  mandate: { version: number; hash: string };
  baseline: { version: number; hash: string } | null;
};

export async function issueAuthorizationReceipt(
  request: TrustedPreflightRequest,
  result: TrustedPreflightResult,
  options?: { ttlSeconds?: number }
): Promise<AuthorizationReceipt> {
  if (result.decision !== "ALLOW") throw new Error("authorization_requires_allow");

  const token = crypto.randomBytes(32).toString("base64url");
  const actionHash = hashIntegrityValue(request.proposed_action);
  const observedStateHash = request.current_state ? hashIntegrityValue(request.current_state) : null;
  const contextHash = hashIntegrityValue({
    goal: request.goal ?? null,
    current_state: request.current_state ?? null,
    attestation_ids: [...(request.attestation_ids ?? [])].sort(),
    trace_excerpt: request.trace_excerpt ?? null,
    tool_description: request.tool_description ?? null,
  });

  const ttlSeconds = options?.ttlSeconds ?? 300;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const subjectId = request.subject_id ?? request.proposed_action.counterparty_id ?? null;

  const { data, error } = await supabase
    .from("integrity_authorizations")
    .insert({
      principal_id: request.principal_id,
      subject_id: subjectId,
      action: request.proposed_action,
      action_hash: actionHash,
      mandate_version: result.trust.mandate.version,
      mandate_hash: result.trust.mandate.hash,
      baseline_version: result.trust.baseline?.version ?? null,
      baseline_hash: result.trust.baseline?.hash ?? null,
      observed_state_hash: observedStateHash,
      token_hash: tokenHash(token),
      decision: "ALLOW",
      status: "issued",
      expires_at: expiresAt,
      metadata: {
        context_hash: contextHash,
        semantic_ran: result.trust.semantic.ran,
        attestation_ids: result.trust.attestations.ids,
      },
    })
    .select("id,expires_at")
    .single();

  if (error || !data) throw new Error("authorization_issue_failed");

  return {
    id: String(data.id),
    token,
    expires_at: String(data.expires_at),
    action_hash: actionHash,
    subject_id: subjectId,
    mandate: { ...result.trust.mandate },
    baseline: result.trust.baseline
      ? { version: result.trust.baseline.version, hash: result.trust.baseline.hash }
      : null,
  };
}

export type ExecutionCommitRequest = {
  authorization_id: string;
  authorization_token: string;
  executed_action: ProposedAction;
  outcome: "succeeded" | "failed";
  resulting_state?: Record<string, Primitive>;
  external_execution_id?: string;
  executed_at?: string;
  metadata?: Record<string, Primitive>;
};

export type ExecutionCommitResult = {
  ok: boolean;
  replayed?: boolean;
  error?: string;
  authorization_id?: string;
  execution_receipt_id?: string;
  outcome?: "succeeded" | "failed";
  subject_id?: string | null;
  baseline_version_after?: number | null;
};

export function isExecutionCommitRequest(value: unknown): value is ExecutionCommitRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<ExecutionCommitRequest>;
  return (
    typeof body.authorization_id === "string" &&
    body.authorization_id.length > 0 &&
    typeof body.authorization_token === "string" &&
    body.authorization_token.length >= 20 &&
    !!body.executed_action &&
    typeof body.executed_action.type === "string" &&
    (body.outcome === "succeeded" || body.outcome === "failed")
  );
}

export async function commitExecution(
  request: ExecutionCommitRequest
): Promise<ExecutionCommitResult> {
  const actionHash = hashIntegrityValue(request.executed_action);
  const stateHash = request.resulting_state ? hashIntegrityValue(request.resulting_state) : null;
  const executedAt = request.executed_at && Number.isFinite(Date.parse(request.executed_at))
    ? new Date(request.executed_at).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabase.rpc("commit_integrity_execution", {
    p_authorization_id: request.authorization_id,
    p_token_hash: tokenHash(request.authorization_token),
    p_action_hash: actionHash,
    p_outcome: request.outcome,
    p_resulting_state: request.resulting_state ?? null,
    p_resulting_state_hash: stateHash,
    p_external_execution_id: request.external_execution_id?.slice(0, 240) ?? null,
    p_executed_at: executedAt,
    p_metadata: request.metadata ?? {},
  });

  if (error) throw new Error("execution_commit_rpc_failed");
  return (data ?? { ok: false, error: "execution_commit_empty" }) as ExecutionCommitResult;
}
