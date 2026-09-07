import { createClient } from "@supabase/supabase-js";
import type { Primitive, ProposedAction } from "./preflight";
import type { TrustedPreflightRequest, TrustedPreflightResult } from "./trusted";
import type { IntegrityClientIdentity } from "./auth";
import { hashIntegrityValue } from "./canonical";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

import crypto from "crypto";

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

export type AuthorizationBudgetReservation = {
  id: string;
  amount: number;
  currency?: string;
  limit: number;
  window_seconds: number;
};

export type AuthorizationIssueOptions = {
  ttlSeconds?: number;
  observation_id?: string | null;
  budgets?: AuthorizationBudgetReservation[];
};

export async function issueAuthorizationReceipt(
  request: TrustedPreflightRequest,
  result: TrustedPreflightResult,
  client: IntegrityClientIdentity,
  options?: AuthorizationIssueOptions
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

  const { data, error } = await supabase.rpc("issue_integrity_authorization", {
    p_principal_id: request.principal_id,
    p_client_id: client.client_id,
    p_subject_id: subjectId,
    p_observation_id: options?.observation_id ?? null,
    p_action: request.proposed_action,
    p_action_hash: actionHash,
    p_mandate_version: result.trust.mandate.version,
    p_mandate_hash: result.trust.mandate.hash,
    p_baseline_version: result.trust.baseline?.version ?? null,
    p_baseline_hash: result.trust.baseline?.hash ?? null,
    p_observed_state_hash: observedStateHash,
    p_token_hash: tokenHash(token),
    p_expires_at: expiresAt,
    p_metadata: {
      context_hash: contextHash,
      semantic_ran: result.trust.semantic.ran,
      attestation_ids: result.trust.attestations.ids,
    },
    p_budgets: options?.budgets ?? [],
  });

  if (error) throw new Error("authorization_issue_failed");

  const issue = data as
    | { ok: true; authorization_id: string }
    | { ok: false; error: string; [key: string]: unknown }
    | null;

  if (!issue) throw new Error("authorization_issue_failed");
  if (!issue.ok) {
    const failure = new Error(issue.error) as Error & { details?: Record<string, unknown> };
    failure.details = issue as Record<string, unknown>;
    throw failure;
  }

  const authorizationId = String(issue.authorization_id);


  return {
    id: authorizationId,
    token,
    expires_at: expiresAt,
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
  request: ExecutionCommitRequest,
  client: IntegrityClientIdentity
): Promise<ExecutionCommitResult> {
  const actionHash = hashIntegrityValue(request.executed_action);
  const stateHash = request.resulting_state ? hashIntegrityValue(request.resulting_state) : null;
  const executedAt = request.executed_at && Number.isFinite(Date.parse(request.executed_at))
    ? new Date(request.executed_at).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabase.rpc("commit_integrity_execution", {
    p_authorization_id: request.authorization_id,
    p_client_id: client.client_id,
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
