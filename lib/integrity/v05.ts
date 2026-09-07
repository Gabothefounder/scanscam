import { createClient } from "@supabase/supabase-js";
import type { IntegrityClientIdentity } from "./auth";
import {
  actionEnvelopeToProposedAction,
  type ActionEffect,
  type ActionEnvelope,
} from "./action-envelope";
import {
  preflight,
  type DecisionCapsule,
  type MandateBudget,
  type MaterialClaim,
  type PreflightResult,
  type PreflightSignal,
  type PrincipalMandate,
  type Primitive,
} from "./preflight";
import { analyzeIntegritySemantics } from "./semantic";
import {
  issueAuthorizationReceipt,
  type AuthorizationBudgetReservation,
  type AuthorizationReceipt,
} from "./receipts";
import type { TrustedPreflightRequest, TrustedPreflightResult } from "./trusted";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type IntegrityDisposition =
  | "ALLOW"
  | "CHALLENGE"
  | "APPROVAL_REQUIRED"
  | "DENY";

export type IntegrityV05Request = {
  observation_id: string;
  attestation_ids?: string[];
};

type ObservationRow = {
  id: string;
  observer_client_id: string;
  protocol: string;
  hook: string;
  envelope: ActionEnvelope;
  envelope_hash: string;
  state_snapshot: Record<string, Primitive> | null;
  state_hash: string | null;
  causal_context: string | null;
  observed_at: string;
  expires_at: string;
};

type MandateContext = {
  principal_id: string;
  version: number;
  mandate: PrincipalMandate;
  mandate_hash: string;
};

type BaselineContext = {
  principal_id: string;
  subject_id: string;
  version: number;
  state: Record<string, Primitive>;
  state_hash: string;
  updated_at: string;
};

type AttestationContext = {
  id: string;
  principal_id: string | null;
  claim_text: string;
  issuer: string;
  evidence: Record<string, Primitive>;
  observed_at: string;
  expires_at: string | null;
};

type ResolvedContext = {
  ok: true;
  subject_id: string | null;
  observation: ObservationRow;
  mandate: MandateContext;
  baseline: BaselineContext | null;
  attestations: AttestationContext[];
  missing_attestation_ids: string[];
};

type ResolveFailure = { ok: false; error: string };

export type IntegrityV05Result = {
  version: "0.5";
  disposition: IntegrityDisposition;
  intervention_score: number;
  action: ActionEnvelope;
  signals: PreflightSignal[];
  required_controls: string[];
  value_guard: {
    preference_score: number;
    matched_count: number;
    private_match_count: number;
  };
  trust: {
    observation_id: string;
    observer_client_id: string;
    observation_protocol: string;
    mandate: { version: number; hash: string };
    baseline: { version: number; hash: string } | null;
    attestation_ids: string[];
    semantic: {
      required: boolean;
      ran: boolean;
      model?: string;
      normalized_effect?: ActionEffect;
      confidence?: number;
    };
  };
  authorization: AuthorizationReceipt | null;
  budget?: {
    error: string;
    budget_id?: string;
    used?: number;
    requested?: number;
    limit?: number;
    currency?: string;
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isIntegrityV05Request(value: unknown): value is IntegrityV05Request {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<IntegrityV05Request>;
  if (typeof body.observation_id !== "string" || !UUID_RE.test(body.observation_id)) return false;
  if (
    body.attestation_ids !== undefined &&
    (!Array.isArray(body.attestation_ids) ||
      body.attestation_ids.some((id) => typeof id !== "string" || !UUID_RE.test(id)))
  ) return false;
  return true;
}

function attestationClaims(rows: AttestationContext[]): MaterialClaim[] {
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

function causalClaims(context: string | null): MaterialClaim[] {
  if (!context) return [];
  const claims: MaterialClaim[] = [];

  const patterns: Array<[RegExp, string]> = [
    [
      /\b(changed|new|updated)\b.{0,50}\b(bank|banking|beneficiary|account|routing|payment destination|wallet)\b/i,
      "Counterparty payment or destination instructions changed.",
    ],
    [
      /\b(acquired|acquisition|merged|merger|new owner|new ownership)\b/i,
      "Counterparty ownership or corporate control changed.",
    ],
    [
      /\b(new|added|unexpected)\b.{0,30}\b(fee|charge|surcharge)\b/i,
      "A new fee or charge applies.",
    ],
    [
      /\b(new|changed|updated)\b.{0,40}\b(domain|email address|contact address)\b/i,
      "Counterparty identity or contact information changed.",
    ],
  ];

  for (const [pattern, text] of patterns) {
    if (pattern.test(context)) claims.push({ text, material: true, evidence: [] });
  }
  return claims;
}

function deceptionSignals(context: string | null): PreflightSignal[] {
  if (!context) return [];
  const signals: PreflightSignal[] = [];

  if (/\b(urgent|urgently|immediately|right now|act now|today only|within the hour)\b/i.test(context)) {
    signals.push({
      code: "DECEPTION_PRESSURE_URGENCY",
      severity: "medium",
      message: "The causal context contains urgency or time-pressure language.",
    });
  }

  if (/\b(don't tell|do not tell|keep this secret|keep this confidential|do not contact|don't contact|bypass|skip the normal)\b/i.test(context)) {
    signals.push({
      code: "DECEPTION_PROCESS_ISOLATION",
      severity: "high",
      message: "The causal context asks the agent to bypass normal verification or isolate the action from review.",
    });
  }

  if (/\b(changed|new|updated)\b.{0,50}\b(bank|banking|beneficiary|account|routing|payment destination|wallet)\b/i.test(context)) {
    signals.push({
      code: "DECEPTION_DESTINATION_CHANGE_CLAIM",
      severity: "high",
      message: "A payment or destination change is part of the causal premise.",
    });
  }

  if (/\b(acquired|acquisition|merged|merger|new owner|new ownership)\b/i.test(context)) {
    signals.push({
      code: "DECEPTION_OWNERSHIP_CHANGE_CLAIM",
      severity: "medium",
      message: "A corporate-control change is part of the causal premise.",
    });
  }

  return signals;
}

function semanticRequired(
  envelope: ActionEnvelope,
  base: PreflightResult,
  deterministicDeception: PreflightSignal[]
): boolean {
  if (envelope.effect === "unknown") return true;
  if (deterministicDeception.some((signal) => signal.severity === "high")) return true;
  if (base.risk >= 0.55) return true;
  return false;
}

function semanticSignals(
  semantic: Awaited<ReturnType<typeof analyzeIntegritySemantics>>
): PreflightSignal[] {
  if (!semantic) return [];
  const signals: PreflightSignal[] = [];

  if (semantic.goal_alignment === "misaligned") {
    signals.push({
      code: "GOAL_ACTION_MISMATCH",
      severity: "high",
      message: semantic.reasons[0] ?? "The action appears inconsistent with the principal's stated goal.",
    });
  }

  if (semantic.deception_signals.length) {
    signals.push({
      code: "SEMANTIC_DECEPTION_CONTEXT",
      severity: "high",
      message: `Semantic inspection found deception-relevant context: ${semantic.deception_signals.slice(0, 3).join("; ")}`,
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
      message: semantic.reasons[0] ?? "Semantic inspection identified a high-impact effect.",
    });
  }

  if (semantic.requires_human_review && !signals.some((signal) => signal.severity === "high")) {
    signals.push({
      code: "SEMANTIC_REVIEW_REQUIRED",
      severity: "high",
      message: semantic.reasons[0] ?? "Semantic inspection requires human review.",
    });
  }

  return signals;
}

function dispositionFor(signals: PreflightSignal[]): IntegrityDisposition {
  if (signals.some((signal) => signal.code.startsWith("BLOCK_"))) return "DENY";

  const approvalCodes = new Set([
    "MANDATE_APPROVAL_REQUIRED",
    "HUMAN_APPROVAL_THRESHOLD",
    "AUTONOMOUS_SPEND_LIMIT_EXCEEDED",
    "COMMITMENT_SCOPE_UNCLEAR",
  ]);

  if (signals.some((signal) => approvalCodes.has(signal.code))) return "APPROVAL_REQUIRED";

  if (
    signals.some((signal) =>
      signal.severity === "high" ||
      signal.severity === "critical"
    )
  ) return "CHALLENGE";

  return "ALLOW";
}

function controlsFor(signals: PreflightSignal[]): string[] {
  const controls = new Set<string>();

  for (const signal of signals) {
    if (signal.code.includes("CLAIM") || signal.code.includes("DECEPTION_")) {
      controls.add("independent_evidence");
    }
    if (signal.code.includes("STATE_CHANGE")) controls.add("verify_material_change");
    if (
      signal.code.includes("APPROVAL") ||
      signal.code.includes("SPEND_LIMIT") ||
      signal.code.includes("COMMITMENT")
    ) controls.add("principal_approval");
    if (signal.code.includes("SEMANTIC")) controls.add("semantic_review");
    if (signal.code.includes("ATTESTATION")) controls.add("valid_attestation");
    if (signal.code.includes("NO_PRIOR_STATE")) controls.add("establish_baseline");
  }

  return [...controls];
}

function matchingBudgets(
  budgets: MandateBudget[] | undefined,
  envelope: ActionEnvelope,
  proposedActionType: string
): AuthorizationBudgetReservation[] {
  if (!budgets?.length || envelope.money?.amount === undefined) return [];

  return budgets
    .filter((budget) => {
      const effectMatch = !budget.effects?.length || budget.effects.includes(envelope.effect);
      const actionMatch = !budget.action_types?.length || budget.action_types.includes(proposedActionType);
      const currencyMatch =
        !budget.currency ||
        !envelope.money?.currency ||
        budget.currency.toUpperCase() === envelope.money.currency.toUpperCase();
      return effectMatch && actionMatch && currencyMatch;
    })
    .map((budget) => ({
      id: budget.id,
      amount: envelope.money!.amount,
      currency: envelope.money?.currency,
      limit: budget.limit,
      window_seconds: budget.window_seconds,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function budgetMode(mandate: PrincipalMandate, budgetId: string | undefined): "approval" | "deny" {
  if (!budgetId) return "approval";
  return mandate.budgets?.find((budget) => budget.id === budgetId)?.mode ?? "approval";
}

async function resolveContext(
  principalId: string,
  request: IntegrityV05Request
): Promise<ResolvedContext> {
  const { data, error } = await supabase.rpc("resolve_integrity_v05_context", {
    p_principal_id: principalId,
    p_observation_id: request.observation_id,
    p_attestation_ids: request.attestation_ids ?? [],
  });

  if (error) throw new Error("integrity_v05_context_lookup_failed");
  const result = data as ResolvedContext | ResolveFailure | null;
  if (!result) throw new Error("integrity_v05_context_lookup_failed");
  if (!result.ok) throw new Error(result.error);
  return result;
}

export async function runIntegrityV05(
  request: IntegrityV05Request,
  actor: IntegrityClientIdentity
): Promise<IntegrityV05Result> {
  if (!["actor", "hybrid"].includes(actor.kind)) {
    throw new Error("integrity_actor_kind_required");
  }

  const resolved = await resolveContext(actor.principal_id, request);
  if (resolved.observation.observer_client_id === actor.client_id) {
    throw new Error("integrity_observation_not_independent");
  }

  const envelope = resolved.observation.envelope;
  const proposedAction = actionEnvelopeToProposedAction(envelope);
  const causalContext = resolved.observation.causal_context;

  const claims = [
    ...causalClaims(causalContext),
    ...attestationClaims(resolved.attestations),
  ];

  const capsule: DecisionCapsule = {
    version: "0.1",
    principal: {
      id: actor.principal_id,
      mandate: resolved.mandate.mandate,
    },
    goal: envelope.goal,
    proposed_action: proposedAction,
    previous_state: resolved.baseline?.state,
    current_state: resolved.observation.state_snapshot ?? undefined,
    claims,
    context: {
      action_envelope: envelope as unknown as Primitive,
      trusted_observation_id: resolved.observation.id,
      trusted_observer_client_id: resolved.observation.observer_client_id,
    },
  };

  const base = preflight(capsule);
  const extraSignals: PreflightSignal[] = [];

  if (resolved.missing_attestation_ids.length) {
    extraSignals.push({
      code: "ATTESTATION_INVALID_OR_UNRESOLVED",
      severity: "high",
      message: "One or more requested attestations were missing, expired, revoked, or scoped to another principal.",
    });
  }

  const consequent =
    envelope.consequences.irreversible ||
    envelope.consequences.creates_commitment ||
    envelope.effect !== "external_communication";

  if (consequent && !causalContext) {
    extraSignals.push({
      code: "TRUSTED_CAUSAL_CONTEXT_MISSING",
      severity: "high",
      message: "The runtime hook did not supply causal context for a consequential action.",
    });
  }

  const deterministicDeception = deceptionSignals(causalContext);
  extraSignals.push(...deterministicDeception);

  const requiresSemantic = semanticRequired(envelope, base, deterministicDeception);
  let semantic: Awaited<ReturnType<typeof analyzeIntegritySemantics>> = null;

  if (requiresSemantic) {
    try {
      semantic = await analyzeIntegritySemantics({
        goal: envelope.goal,
        action: proposedAction,
        tool_description: envelope.tool.description,
        trace_excerpt: causalContext ?? undefined,
      });
    } catch {
      semantic = null;
    }

    if (!semantic) {
      extraSignals.push({
        code: "SEMANTIC_REQUIRED_UNAVAILABLE",
        severity: "high",
        message: "Server policy requires semantic inspection for this action, but the semantic sensor is unavailable.",
      });
    } else {
      extraSignals.push(...semanticSignals(semantic));
    }
  }

  const allSignals = [...base.signals, ...extraSignals];
  let disposition = dispositionFor(allSignals);
  let authorization: AuthorizationReceipt | null = null;
  let budget: IntegrityV05Result["budget"];

  const trustedIssueResult: TrustedPreflightResult = {
    ...base,
    decision: disposition === "ALLOW" ? "ALLOW" : "VERIFY",
    signals: allSignals,
    trust_signals: extraSignals,
    required_controls: [...new Set([...base.required_controls, ...controlsFor(extraSignals)])],
    trust: {
      capsule_source: "server-built",
      mandate: {
        version: resolved.mandate.version,
        hash: resolved.mandate.mandate_hash,
      },
      baseline: resolved.baseline
        ? {
            subject_id: resolved.baseline.subject_id,
            version: resolved.baseline.version,
            hash: resolved.baseline.state_hash,
            updated_at: resolved.baseline.updated_at,
          }
        : null,
      attestations: {
        requested: request.attestation_ids?.length ?? 0,
        resolved: resolved.attestations.length,
        ids: resolved.attestations.map((item) => item.id),
      },
      ignored_client_authority: [],
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

  if (disposition === "ALLOW") {
    const trustedRequest: TrustedPreflightRequest = {
      principal_id: actor.principal_id,
      subject_id: resolved.subject_id ?? undefined,
      goal: envelope.goal,
      proposed_action: proposedAction,
      current_state: resolved.observation.state_snapshot ?? undefined,
      attestation_ids: request.attestation_ids,
      trace_excerpt: causalContext ?? undefined,
      tool_description: envelope.tool.description,
      context: {
        action_envelope: envelope as unknown as Primitive,
        trusted_observation_id: resolved.observation.id,
      },
      semantic_mode: "off",
    };

    try {
      authorization = await issueAuthorizationReceipt(
        trustedRequest,
        trustedIssueResult,
        actor,
        {
          observation_id: resolved.observation.id,
          budgets: matchingBudgets(
            resolved.mandate.mandate.budgets,
            envelope,
            proposedAction.type
          ),
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "authorization_issue_failed";
      const details = (error as Error & { details?: Record<string, unknown> }).details;
      if (message === "budget_exceeded") {
        const id = typeof details?.budget_id === "string" ? details.budget_id : undefined;
        disposition = budgetMode(resolved.mandate.mandate, id) === "deny"
          ? "DENY"
          : "APPROVAL_REQUIRED";
        budget = {
          error: message,
          budget_id: id,
          used: typeof details?.used === "number" ? details.used : Number(details?.used),
          requested: typeof details?.requested === "number" ? details.requested : Number(details?.requested),
          limit: typeof details?.limit === "number" ? details.limit : Number(details?.limit),
          currency: typeof details?.currency === "string" ? details.currency : undefined,
        };
        extraSignals.push({
          code: "BUDGET_RESERVATION_EXCEEDED",
          severity: disposition === "DENY" ? "critical" : "high",
          message: "The principal's server-side concurrent budget is exhausted for this action.",
        });
      } else {
        throw error;
      }
    }
  }

  const finalSignals = [...base.signals, ...extraSignals];
  const privateMatches = base.checks.value.matched_objectives.filter((item) => item.private).length;
  const riskSignals = finalSignals.filter((signal) => !signal.code.startsWith("VALUE_"));
  const interventionScore = Math.max(
    base.risk,
    riskSignals.some((signal) => signal.severity === "critical") ? 0.9 :
      riskSignals.some((signal) => signal.severity === "high") ? 0.65 : base.risk
  );

  return {
    version: "0.5",
    disposition,
    intervention_score: Number(Math.min(1, interventionScore).toFixed(3)),
    action: envelope,
    signals: finalSignals.filter((signal) => !signal.code.startsWith("VALUE_")),
    required_controls: [...new Set([...base.required_controls, ...controlsFor(extraSignals)])],
    value_guard: {
      preference_score: base.checks.value.preference_score,
      matched_count: base.checks.value.matched_objectives.length,
      private_match_count: privateMatches,
    },
    trust: {
      observation_id: resolved.observation.id,
      observer_client_id: resolved.observation.observer_client_id,
      observation_protocol: resolved.observation.protocol,
      mandate: {
        version: resolved.mandate.version,
        hash: resolved.mandate.mandate_hash,
      },
      baseline: resolved.baseline
        ? {
            version: resolved.baseline.version,
            hash: resolved.baseline.state_hash,
          }
        : null,
      attestation_ids: resolved.attestations.map((item) => item.id),
      semantic: {
        required: requiresSemantic,
        ran: !!semantic,
        model: semantic?.model,
        normalized_effect: semantic?.normalized_effect,
        confidence: semantic?.confidence,
      },
    },
    authorization,
    budget,
  };
}
