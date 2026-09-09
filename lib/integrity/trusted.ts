import { createClient } from "@supabase/supabase-js";
import {
  preflight,
  type DecisionCapsule,
  type MaterialClaim,
  type PreflightDecision,
  type PreflightResult,
  type PreflightSignal,
  type Primitive,
  type PrincipalMandate,
  type ProposedAction,
  type Severity,
} from "./preflight";
import { analyzeIntegritySemantics, type IntegritySemanticResult } from "./semantic";
import type { IntegrityClientIdentity } from "./auth";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type TrustedPreflightRequest = {
  principal_id: string;
  subject_id?: string;
  goal?: string;
  proposed_action: ProposedAction;
  current_state?: Record<string, Primitive>;
  reported_claims?: Array<{ text: string; material?: boolean }>;
  attestation_ids?: string[];
  trace_excerpt?: string;
  tool_description?: string;
  context?: Record<string, Primitive>;
  semantic_mode?: "auto" | "off" | "on";
};

type MandateRow = {
  principal_id: string;
  version: number;
  mandate: PrincipalMandate;
  mandate_hash: string;
};

type BaselineRow = {
  principal_id: string;
  subject_id: string;
  version: number;
  state: Record<string, Primitive>;
  state_hash: string;
  updated_at: string;
};

type AttestationRow = {
  id: string;
  principal_id: string | null;
  claim_text: string;
  issuer: string;
  evidence: Record<string, Primitive>;
  observed_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type TrustedPreflightResult = PreflightResult & {
  trust: {
    capsule_source: "server-built";
    mandate: { version: number; hash: string };
    baseline: { subject_id: string; version: number; hash: string; updated_at: string } | null;
    attestations: { requested: number; resolved: number; ids: string[] };
    ignored_client_authority: string[];
    semantic: {
      ran: boolean;
      model?: string;
      goal_alignment?: string;
      effects?: string[];
    };
  };
  trust_signals: PreflightSignal[];
};

const CONSEQUENT_ACTIONS = new Set([
  "send_payment", "transfer_funds", "change_payment_destination",
  "change_vendor_bank_account", "accept_fee", "accept_terms", "sign_contract",
  "promise_refund", "offer_discount", "grant_access", "publish", "place_order",
  "book", "settle_claim", "delete_production_database",
]);

const KNOWN_ACTIONS = new Set([
  ...CONSEQUENT_ACTIONS,
  "cancel", "draft_report", "search", "read", "summarize",
]);

function severityRank(severity: Severity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[severity];
}

function decisionRank(decision: PreflightDecision): number {
  return { ALLOW: 0, VERIFY: 1, HOLD: 2, BLOCK: 3 }[decision];
}

function maxDecision(left: PreflightDecision, right: PreflightDecision): PreflightDecision {
  return decisionRank(left) >= decisionRank(right) ? left : right;
}

function decisionForTrustSignals(signals: PreflightSignal[]): PreflightDecision {
  if (signals.some((signal) => signal.severity === "critical")) return "HOLD";
  if (signals.some((signal) => severityRank(signal.severity) >= severityRank("high"))) return "VERIFY";
  return "ALLOW";
}

function uniqueClaims(claims: MaterialClaim[]): MaterialClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = claim.text.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function heuristicClaims(trace?: string): MaterialClaim[] {
  if (!trace) return [];
  const t = trace.trim();
  if (!t) return [];
  const claims: MaterialClaim[] = [];

  const patterns: Array<[RegExp, string]> = [
    [/\b(changed|change|new)\b.{0,40}\b(bank|banking|beneficiary|payment destination|routing)\b/i, "Counterparty payment or banking instructions changed."],
    [/\b(acquired|acquisition|new ownership|new owner|merged|merger)\b/i, "Counterparty ownership or corporate control changed."],
    [/\b(cancellation|service|processing|administrative) fee\b/i, "A new fee or charge applies."],
    [/\b(new|changed)\b.{0,35}\b(email domain|domain|wallet|address)\b/i, "Counterparty identity or destination information changed."],
  ];

  for (const [pattern, text] of patterns) {
    if (pattern.test(t)) claims.push({ text, material: true, evidence: [] });
  }
  return claims;
}

function shouldRequireTrace(action: ProposedAction): boolean {
  return action.irreversible === true || action.creates_commitment === true || CONSEQUENT_ACTIONS.has(action.type);
}

function shouldRunSemantic(request: TrustedPreflightRequest): boolean {
  if (request.semantic_mode === "off") return false;
  if (request.semantic_mode === "on") return true;
  if (!KNOWN_ACTIONS.has(request.proposed_action.type)) return true;
  if (request.tool_description) return true;
  if (request.goal && request.proposed_action.type !== "search" && request.proposed_action.type !== "read") return true;
  return false;
}

async function resolveMandate(principalId: string): Promise<MandateRow> {
  const { data, error } = await supabase
    .from("integrity_mandates")
    .select("principal_id,version,mandate,mandate_hash")
    .eq("principal_id", principalId)
    .eq("active", true)
    .single();

  if (error || !data) throw new Error("trusted_mandate_not_found");
  return data as MandateRow;
}

async function resolveBaseline(principalId: string, subjectId?: string): Promise<BaselineRow | null> {
  if (!subjectId) return null;
  const { data, error } = await supabase
    .from("integrity_baselines")
    .select("principal_id,subject_id,version,state,state_hash,updated_at")
    .eq("principal_id", principalId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) throw new Error("trusted_baseline_lookup_failed");
  return (data as BaselineRow | null) ?? null;
}

async function resolveAttestations(
  principalId: string,
  ids: string[]
): Promise<{ rows: AttestationRow[]; missing: string[] }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { rows: [], missing: [] };

  const { data, error } = await supabase
    .from("integrity_attestations")
    .select("id,principal_id,claim_text,issuer,evidence,observed_at,expires_at,revoked_at")
    .in("id", unique);

  if (error) throw new Error("trusted_attestation_lookup_failed");

  const now = Date.now();
  const rows = ((data ?? []) as AttestationRow[]).filter((row) => {
    if (row.revoked_at) return false;
    if (row.principal_id && row.principal_id !== principalId) return false;
    if (row.expires_at && Date.parse(row.expires_at) <= now) return false;
    return true;
  });
  const resolved = new Set(rows.map((row) => row.id));
  return { rows, missing: unique.filter((id) => !resolved.has(id)) };
}

function attestationClaims(rows: AttestationRow[]): MaterialClaim[] {
  return rows.map((row) => ({
    text: row.claim_text,
    material: true,
    evidence: [{
      source: `attestation:${row.id}:${row.issuer}`,
      verified: true,
      independent: true,
      observed_at: row.observed_at,
    }],
  }));
}

function reportedClaims(request: TrustedPreflightRequest): MaterialClaim[] {
  return (request.reported_claims ?? []).map((claim) => ({
    text: claim.text,
    material: claim.material !== false,
    evidence: [],
  }));
}

function semanticSignals(semantic: IntegritySemanticResult | null): PreflightSignal[] {
  if (!semantic) return [];
  const signals: PreflightSignal[] = [];
  if (semantic.goal_alignment === "misaligned") {
    signals.push({
      code: "GOAL_ACTION_MISMATCH",
      severity: "high",
      message: semantic.reasons[0] ?? "The proposed action appears inconsistent with the principal's stated goal.",
    });
  }
  if (
    semantic.effects.includes("privileged_access") ||
    semantic.effects.includes("destructive") ||
    semantic.effects.includes("data_disclosure")
  ) {
    signals.push({
      code: "SEMANTIC_HIGH_IMPACT_EFFECT",
      severity: "high",
      message: semantic.reasons.find(Boolean) ?? "Semantic analysis identified a high-impact effect.",
    });
  }
  if (semantic.requires_human_review && !signals.some((signal) => signal.severity === "high")) {
    signals.push({
      code: "SEMANTIC_REVIEW_REQUIRED",
      severity: "high",
      message: semantic.reasons[0] ?? "Semantic analysis requires human review.",
    });
  }
  return signals;
}

export type UnboundTrustedPreflightRequest = Omit<TrustedPreflightRequest, "principal_id"> & {
  principal_id?: string;
};

export function isUnboundTrustedPreflightRequest(value: unknown): value is UnboundTrustedPreflightRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<UnboundTrustedPreflightRequest>;
  return (
    !!body.proposed_action &&
    typeof body.proposed_action.type === "string" &&
    body.proposed_action.type.trim().length > 0
  );
}

export function bindAuthenticatedPrincipal(
  request: UnboundTrustedPreflightRequest,
  identity: IntegrityClientIdentity
): TrustedPreflightRequest {
  return {
    ...request,
    principal_id: identity.principal_id,
  };
}

export function isTrustedPreflightRequest(value: unknown): value is TrustedPreflightRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<TrustedPreflightRequest>;
  return (
    typeof body.principal_id === "string" &&
    body.principal_id.trim().length > 0 &&
    !!body.proposed_action &&
    typeof body.proposed_action.type === "string" &&
    body.proposed_action.type.trim().length > 0
  );
}

export async function trustedPreflight(
  request: TrustedPreflightRequest,
  rawBody?: Record<string, unknown>
): Promise<TrustedPreflightResult> {
  const subjectId = request.subject_id ?? request.proposed_action.counterparty_id;
  const [mandateRow, baseline, attestations] = await Promise.all([
    resolveMandate(request.principal_id),
    resolveBaseline(request.principal_id, subjectId),
    resolveAttestations(request.principal_id, request.attestation_ids ?? []),
  ]);

  const ignoredClientAuthority: string[] = [];
  if (rawBody && "principal_id" in rawBody) ignoredClientAuthority.push("principal_id");
  if (rawBody && "principal" in rawBody) ignoredClientAuthority.push("principal");
  if (rawBody && "previous_state" in rawBody) ignoredClientAuthority.push("previous_state");
  if (rawBody && "verified_evidence" in rawBody) ignoredClientAuthority.push("verified_evidence");

  let semantic: IntegritySemanticResult | null = null;
  if (shouldRunSemantic(request)) {
    try {
      semantic = await analyzeIntegritySemantics({
        goal: request.goal,
        action: request.proposed_action,
        tool_description: request.tool_description,
        trace_excerpt: request.trace_excerpt,
      });
    } catch {
      semantic = null;
    }
  }

  const claims = uniqueClaims([
    ...reportedClaims(request),
    ...heuristicClaims(request.trace_excerpt),
    ...attestationClaims(attestations.rows),
    ...(semantic?.material_claims ?? []).map((text) => ({ text, material: true, evidence: [] })),
  ]);

  const capsule: DecisionCapsule = {
    version: "0.1",
    principal: {
      id: request.principal_id,
      mandate: mandateRow.mandate,
    },
    goal: request.goal,
    proposed_action: request.proposed_action,
    // Compare against the trusted baseline only when the caller actually reports
    // a current observation. Absence of current state is not a state deletion.
    previous_state: request.current_state ? baseline?.state : undefined,
    current_state: request.current_state,
    claims,
    context: {
      ...(request.context ?? {}),
      trusted_subject_id: subjectId ?? null,
      trusted_baseline_version: baseline?.version ?? null,
      trusted_mandate_version: mandateRow.version,
    },
  };

  const base = preflight(capsule);
  const trustSignals: PreflightSignal[] = [];

  if (ignoredClientAuthority.length) {
    trustSignals.push({
      code: "UNTRUSTED_AUTHORITY_IGNORED",
      severity: "info",
      message: `Ignored client-supplied authority fields: ${ignoredClientAuthority.join(", ")}.`,
    });
  }

  if (attestations.missing.length) {
    trustSignals.push({
      code: "ATTESTATION_INVALID_OR_UNRESOLVED",
      severity: "high",
      message: "One or more requested attestations were missing, expired, revoked, or scoped to another principal.",
    });
  }

  if (
    shouldRequireTrace(request.proposed_action) &&
    subjectId &&
    baseline &&
    !request.current_state
  ) {
    trustSignals.push({
      code: "CURRENT_STATE_MISSING",
      severity: "high",
      message: "A consequential action with historical state requires a current observation before comparison.",
    });
  }

  if (shouldRequireTrace(request.proposed_action) && !request.trace_excerpt) {
    trustSignals.push({
      code: "CAUSAL_TRACE_MISSING",
      severity: "high",
      message: "A consequential action requires a causal trace excerpt so material premises cannot be silently omitted.",
    });
  }

  trustSignals.push(...semanticSignals(semantic));

  const decision = maxDecision(base.decision, decisionForTrustSignals(trustSignals));
  const allSignals = [...base.signals, ...trustSignals];
  const risk = Math.max(
    base.risk,
    trustSignals.some((signal) => signal.severity === "high" || signal.severity === "critical") ? 0.65 : base.risk
  );

  return {
    ...base,
    decision,
    risk: Number(Math.min(1, risk).toFixed(3)),
    signals: allSignals,
    trust_signals: trustSignals,
    required_controls: [
      ...new Set([
        ...base.required_controls,
        ...(attestations.missing.length ? ["valid_attestation"] : []),
        ...(trustSignals.some((signal) => signal.code === "CAUSAL_TRACE_MISSING") ? ["provide_causal_trace"] : []),
        ...(trustSignals.some((signal) => signal.code.startsWith("SEMANTIC_") || signal.code === "GOAL_ACTION_MISMATCH")
          ? ["principal_approval"]
          : []),
      ]),
    ],
    summary:
      decision === base.decision
        ? base.summary
        : decision === "VERIFY"
          ? "Proceed only after trusted-input or semantic integrity concerns are resolved."
          : base.summary,
    trust: {
      capsule_source: "server-built",
      mandate: { version: mandateRow.version, hash: mandateRow.mandate_hash },
      baseline: baseline
        ? {
            subject_id: baseline.subject_id,
            version: baseline.version,
            hash: baseline.state_hash,
            updated_at: baseline.updated_at,
          }
        : null,
      attestations: {
        requested: request.attestation_ids?.length ?? 0,
        resolved: attestations.rows.length,
        ids: attestations.rows.map((row) => row.id),
      },
      ignored_client_authority: ignoredClientAuthority,
      semantic: semantic
        ? {
            ran: true,
            model: semantic.model,
            goal_alignment: semantic.goal_alignment,
            effects: semantic.effects,
          }
        : { ran: false },
    },
  };
}
