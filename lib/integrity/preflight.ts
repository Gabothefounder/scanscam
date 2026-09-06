export type PreflightDecision = "ALLOW" | "VERIFY" | "HOLD" | "BLOCK";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Primitive =
  | string
  | number
  | boolean
  | null
  | Primitive[]
  | { [key: string]: Primitive };

export type EvidenceItem = {
  source?: string;
  kind?: string;
  verified?: boolean;
  independent?: boolean;
  observed_at?: string;
};

export type MaterialClaim = {
  id?: string;
  text: string;
  material?: boolean;
  evidence?: EvidenceItem[];
};

export type MandateRule = {
  id?: string;
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "lte" | "gte" | "exists";
  value?: Primitive;
  effect: "block" | "require_approval" | "prefer" | "avoid";
  reason?: string;
};

export type PrincipalMandate = {
  currency?: string;
  max_autonomous_amount?: number;
  human_approval_amount?: number;
  blocked_action_types?: string[];
  approval_action_types?: string[];
  rules?: MandateRule[];
};

export type ProposedAction = {
  type: string;
  amount?: number;
  currency?: string;
  counterparty_id?: string;
  irreversible?: boolean;
  creates_commitment?: boolean;
  destination?: string;
  metadata?: Record<string, Primitive>;
};

export type DecisionCapsule = {
  version?: "0.1";
  principal?: {
    id?: string;
    mandate?: PrincipalMandate;
  };
  goal?: string;
  proposed_action: ProposedAction;
  previous_state?: Record<string, Primitive>;
  current_state?: Record<string, Primitive>;
  claims?: MaterialClaim[];
  context?: Record<string, Primitive>;
};

export type PreflightSignal = {
  code: string;
  severity: Severity;
  message: string;
  path?: string;
};

export type CheckResult = {
  status: "pass" | "notice" | "verify" | "hold" | "block";
  score: number;
  signals: PreflightSignal[];
};

export type PreflightResult = {
  version: "0.1";
  decision: PreflightDecision;
  risk: number;
  checks: {
    change: CheckResult;
    mandate: CheckResult;
    commitment: CheckResult;
    verify: CheckResult;
    challenge: CheckResult;
  };
  signals: PreflightSignal[];
  required_controls: string[];
  summary: string;
};

const SENSITIVE_KEYWORDS = [
  "bank", "beneficiary", "payment", "payout", "destination", "wallet",
  "routing", "account", "price", "amount", "fee", "currency", "domain",
  "email", "phone", "permission", "scope", "role", "access", "contract",
  "term", "refund", "shipping", "address", "counterparty",
];

const HIGH_IMPACT_CHANGE_KEYWORDS = [
  "bank", "beneficiary", "payment_destination", "payout", "destination", "wallet",
  "routing", "domain", "email", "permission", "scope", "role", "access", "contract",
];

const NUMERIC_VARIATION_KEYWORDS = ["price", "amount", "fee"];

const COMMITMENT_ACTIONS = new Set([
  "send_payment", "transfer_funds", "change_payment_destination",
  "change_vendor_bank_account", "accept_fee", "accept_terms", "sign_contract",
  "promise_refund", "offer_discount", "grant_access", "publish", "place_order",
  "book", "cancel", "settle_claim",
]);

const EXPLICIT_SCOPE_COMMITMENTS = new Set([
  "change_payment_destination", "change_vendor_bank_account", "accept_fee",
  "accept_terms", "sign_contract", "promise_refund", "offer_discount",
  "grant_access", "settle_claim",
]);

const FINANCIAL_ACTIONS = new Set([
  "send_payment", "transfer_funds", "change_payment_destination",
  "change_vendor_bank_account", "accept_fee", "place_order", "book",
  "promise_refund", "offer_discount", "settle_claim",
]);

const AMOUNT_REQUIRED_ACTIONS = new Set([
  "send_payment", "transfer_funds", "accept_fee", "place_order",
  "promise_refund", "offer_discount", "settle_claim",
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: Primitive | undefined): value is Record<string, Primitive> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableString(value: Primitive | undefined): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableString).join(",")}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableString(v)}`).join(",")}}`;
}

function flatten(
  input: Record<string, Primitive> | undefined,
  prefix = "",
  output: Record<string, Primitive> = {}
): Record<string, Primitive> {
  if (!input) return output;
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value)) flatten(value, path, output);
    else output[path] = value;
  }
  return output;
}

function pathLooksSensitive(path: string): boolean {
  const lower = path.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function numericChangeSeverity(
  path: string,
  before: Primitive | undefined,
  after: Primitive | undefined
): Severity | null {
  const lower = path.toLowerCase();
  if (!NUMERIC_VARIATION_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;
  if (typeof before !== "number" || typeof after !== "number") return "medium";
  if (!Number.isFinite(before) || !Number.isFinite(after)) return "high";
  if (lower.includes("fee") && before === 0 && after > 0) return "high";
  const denominator = Math.max(Math.abs(before), 1);
  const ratio = Math.abs(after - before) / denominator;
  if (ratio <= 0.1) return "low";
  if (ratio <= 0.2) return "medium";
  return "high";
}

function changeSeverity(
  path: string,
  before: Primitive | undefined,
  after: Primitive | undefined
): Severity {
  const numeric = numericChangeSeverity(path, before, after);
  if (numeric) return numeric;
  const lower = path.toLowerCase();
  if (HIGH_IMPACT_CHANGE_KEYWORDS.some((keyword) => lower.includes(keyword))) return "high";
  return pathLooksSensitive(path) ? "medium" : "low";
}

function isFinancialAction(action: ProposedAction): boolean {
  return FINANCIAL_ACTIONS.has(action.type) || typeof action.destination === "string";
}

function actionAmount(action: ProposedAction): number | null {
  return typeof action.amount === "number" && Number.isFinite(action.amount) ? action.amount : null;
}

function claimRequiresFreshEvidence(text: string): boolean {
  return /\b(current|currently|remains|still|now|today|bank|authorized|active|valid|ownership|acquired)\b/i.test(text);
}

function severityWeight(severity: Severity): number {
  return { info: 0.02, low: 0.08, medium: 0.2, high: 0.4, critical: 0.7 }[severity];
}

function statusFromSignals(signals: PreflightSignal[]): CheckResult["status"] {
  if (signals.some((s) => s.code.startsWith("BLOCK_"))) return "block";
  if (signals.some((s) => s.severity === "critical")) return "hold";
  if (signals.some((s) => s.severity === "high")) return "verify";
  if (signals.length) return "notice";
  return "pass";
}

function scoreSignals(signals: PreflightSignal[]): number {
  return clamp(signals.reduce((sum, signal) => sum + severityWeight(signal.severity), 0));
}

function buildCheck(signals: PreflightSignal[]): CheckResult {
  return { status: statusFromSignals(signals), score: scoreSignals(signals), signals };
}

function getPath(source: Record<string, Primitive>, path: string): Primitive | undefined {
  const parts = path.split(".");
  let cursor: Primitive = source;
  for (const part of parts) {
    if (!isRecord(cursor) || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function valuesEqual(left: Primitive | undefined, right: Primitive | undefined): boolean {
  return stableString(left) === stableString(right);
}

function primitiveIn(haystack: Primitive | undefined, needle: Primitive | undefined): boolean {
  if (!Array.isArray(haystack)) return false;
  return haystack.some((item) => valuesEqual(item, needle));
}

function evaluateRule(rule: MandateRule, action: ProposedAction, capsule: DecisionCapsule): boolean {
  const root: Record<string, Primitive> = {
    action: action as unknown as Primitive,
    context: (capsule.context ?? {}) as unknown as Primitive,
    current_state: (capsule.current_state ?? {}) as unknown as Primitive,
  };
  const actual = getPath(root, rule.field);
  switch (rule.operator) {
    case "eq": return valuesEqual(actual, rule.value);
    case "neq": return !valuesEqual(actual, rule.value);
    case "in": return primitiveIn(rule.value, actual);
    case "not_in": return !primitiveIn(rule.value, actual);
    case "lte":
      return typeof actual === "number" && typeof rule.value === "number" && actual <= rule.value;
    case "gte":
      return typeof actual === "number" && typeof rule.value === "number" && actual >= rule.value;
    case "exists":
      return actual !== undefined && actual !== null;
  }
}

export function runChangeGuard(capsule: DecisionCapsule): CheckResult {
  const before = flatten(capsule.previous_state);
  const after = flatten(capsule.current_state);
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const signals: PreflightSignal[] = [];

  for (const path of paths) {
    if (valuesEqual(before[path], after[path])) continue;
    const severity = changeSeverity(path, before[path], after[path]);
    signals.push({
      code: severity === "high" ? "SENSITIVE_STATE_CHANGE" : "STATE_CHANGE",
      severity,
      path,
      message: severity === "high" ? `Material state changed at ${path}.` : `State changed at ${path}.`,
    });
  }

  if (!capsule.previous_state && capsule.proposed_action.counterparty_id) {
    const amount = actionAmount(capsule.proposed_action);
    const approval = capsule.principal?.mandate?.human_approval_amount;
    const stakeThreshold =
      typeof approval === "number" && approval > 0 ? Math.min(500, approval * 0.2) : 500;
    const severity: Severity =
      isFinancialAction(capsule.proposed_action) && amount !== null && amount >= stakeThreshold
        ? "high"
        : "medium";
    signals.push({
      code: "NO_PRIOR_STATE",
      severity,
      message: severity === "high"
        ? "No trusted prior state exists for a material first-time counterparty action."
        : "No prior state was provided for this counterparty action.",
    });
  }
  return buildCheck(signals);
}

export function runMandateCheck(capsule: DecisionCapsule): CheckResult {
  const mandate = capsule.principal?.mandate;
  const action = capsule.proposed_action;
  const signals: PreflightSignal[] = [];

  if (!mandate) {
    signals.push({
      code: "MANDATE_MISSING",
      severity: "low",
      message: "No principal mandate was supplied; only generic integrity checks can run.",
    });
    return buildCheck(signals);
  }

  const rawAmount = (action as unknown as { amount?: unknown }).amount;
  if (rawAmount !== undefined && (typeof rawAmount !== "number" || !Number.isFinite(rawAmount) || rawAmount < 0)) {
    signals.push({
      code: "INVALID_AMOUNT",
      severity: "high",
      message: "Financial amount must be a finite non-negative number.",
    });
  }

  if (AMOUNT_REQUIRED_ACTIONS.has(action.type) && rawAmount === undefined) {
    signals.push({
      code: "FINANCIAL_AMOUNT_MISSING",
      severity: "high",
      message: `Action type ${action.type} requires an amount before it can be evaluated safely.`,
    });
  }

  if (
    mandate.currency &&
    action.currency &&
    mandate.currency.toUpperCase() !== action.currency.toUpperCase() &&
    typeof rawAmount === "number"
  ) {
    signals.push({
      code: "CURRENCY_CONVERSION_REQUIRED",
      severity: "high",
      message: `Mandate limits are denominated in ${mandate.currency}; action is denominated in ${action.currency}.`,
    });
  }

  const aggregate = capsule.context?.aggregate_amount_last_hour;
  if (
    typeof aggregate === "number" &&
    Number.isFinite(aggregate) &&
    typeof mandate.human_approval_amount === "number" &&
    aggregate >= mandate.human_approval_amount
  ) {
    signals.push({
      code: "AGGREGATE_SPEND_THRESHOLD",
      severity: "high",
      message: "Recent aggregate spend meets or exceeds the principal's approval threshold.",
    });
  }

  if (mandate.blocked_action_types?.includes(action.type)) {
    signals.push({
      code: "BLOCK_ACTION_TYPE",
      severity: "critical",
      message: `Principal mandate blocks action type ${action.type}.`,
    });
  }

  if (mandate.approval_action_types?.includes(action.type)) {
    signals.push({
      code: "MANDATE_APPROVAL_REQUIRED",
      severity: "high",
      message: `Principal mandate requires approval for action type ${action.type}.`,
    });
  }

  if (
    typeof action.amount === "number" &&
    typeof mandate.max_autonomous_amount === "number" &&
    action.amount > mandate.max_autonomous_amount
  ) {
    signals.push({
      code: "AUTONOMOUS_SPEND_LIMIT_EXCEEDED",
      severity: "critical",
      message: `Action amount ${action.amount} exceeds autonomous limit ${mandate.max_autonomous_amount}.`,
    });
  } else if (
    typeof action.amount === "number" &&
    typeof mandate.human_approval_amount === "number" &&
    action.amount >= mandate.human_approval_amount
  ) {
    signals.push({
      code: "HUMAN_APPROVAL_THRESHOLD",
      severity: "high",
      message: `Action amount ${action.amount} meets the principal's human-approval threshold.`,
    });
  }

  for (const rule of mandate.rules ?? []) {
    if (!evaluateRule(rule, action, capsule)) continue;
    const severity: Severity =
      rule.effect === "block" ? "critical" : rule.effect === "require_approval" ? "high" : "medium";
    const prefix = rule.effect === "block" ? "BLOCK_" : "MANDATE_";
    signals.push({
      code: `${prefix}${(rule.id ?? rule.field).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
      severity,
      message: rule.reason ?? `Mandate rule ${rule.id ?? rule.field} matched.`,
      path: rule.field,
    });
  }

  return buildCheck(signals);
}

export function runCommitmentGuard(capsule: DecisionCapsule): CheckResult {
  const action = capsule.proposed_action;
  const signals: PreflightSignal[] = [];
  const isCommitment = action.creates_commitment === true || COMMITMENT_ACTIONS.has(action.type);

  if (!isCommitment) return buildCheck(signals);

  signals.push({
    code: "PRINCIPAL_COMMITMENT",
    severity: "medium",
    message: `Action ${action.type} can create a commitment on behalf of the principal.`,
  });

  const mandate = capsule.principal?.mandate;
  const explicitlyApproved = mandate?.approval_action_types?.includes(action.type);
  const blocked = mandate?.blocked_action_types?.includes(action.type);

  if (!mandate) {
    signals.push({
      code: "COMMITMENT_WITHOUT_MANDATE",
      severity: "high",
      message: "A commitment is proposed without an explicit principal mandate.",
    });
  } else if (
    !blocked &&
    !explicitlyApproved &&
    (action.creates_commitment === true || EXPLICIT_SCOPE_COMMITMENTS.has(action.type))
  ) {
    signals.push({
      code: "COMMITMENT_SCOPE_UNCLEAR",
      severity: "high",
      message: "The action can bind the principal but the mandate does not explicitly describe approval scope.",
    });
  }

  const legalEffect = action.metadata?.legal_effect;
  if (typeof legalEffect === "string" && /binding|contract|obligation|liability/i.test(legalEffect)) {
    signals.push({
      code: "SEMANTIC_BINDING_EFFECT",
      severity: "high",
      message: "Action metadata indicates a binding legal or commercial effect.",
    });
  }

  const permission = action.metadata?.permission;
  const target = action.metadata?.target;
  if (
    typeof permission === "string" &&
    /admin|root|owner|write/i.test(permission) &&
    (typeof target !== "string" || /production|prod|account|workspace/i.test(target))
  ) {
    signals.push({
      code: "HIGH_PRIVILEGE_ACCESS",
      severity: "high",
      message: "Action metadata indicates a high-privilege access grant.",
    });
  }

  if (
    action.type === "publish" &&
    (action.metadata?.contains_personal_data === true || capsule.context?.data_classification === "confidential")
  ) {
    signals.push({
      code: "SENSITIVE_DATA_PUBLICATION",
      severity: "high",
      message: "The action would publish sensitive or confidential data.",
    });
  }

  return buildCheck(signals);
}

export function runVerifyCheck(capsule: DecisionCapsule): CheckResult {
  const signals: PreflightSignal[] = [];
  for (const claim of capsule.claims ?? []) {
    if (claim.material === false) continue;
    const evidence = claim.evidence ?? [];
    const verifiedIndependent = evidence.filter((item) => item.verified && item.independent);
    if (verifiedIndependent.length === 0) {
      signals.push({
        code: "MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED",
        severity: "high",
        message: `Material claim lacks independent verified evidence: ${claim.text}`,
      });
      continue;
    }

    if (claimRequiresFreshEvidence(claim.text)) {
      const dated = verifiedIndependent
        .map((item) => item.observed_at ? Date.parse(item.observed_at) : NaN)
        .filter((value) => Number.isFinite(value));
      if (dated.length > 0) {
        const newest = Math.max(...dated);
        const ageDays = (Date.now() - newest) / 86_400_000;
        if (ageDays > 180) {
          signals.push({
            code: "EVIDENCE_STALE",
            severity: "high",
            message: `Independent evidence is too stale for a freshness-sensitive material claim: ${claim.text}`,
          });
        }
      }
    }
  }
  return buildCheck(signals);
}

export function runChallengeCheck(
  capsule: DecisionCapsule,
  prior: Omit<PreflightResult["checks"], "challenge">
): CheckResult {
  const signals: PreflightSignal[] = [];
  if (capsule.proposed_action.irreversible) {
    signals.push({
      code: "IRREVERSIBLE_ACTION",
      severity: "high",
      message: "The proposed action is marked irreversible and requires an explicit integrity checkpoint.",
    });
  }

  const materialRiskCount = Object.values(prior).filter((check) => check.score >= 0.4).length;
  if (materialRiskCount >= 2) {
    signals.push({
      code: "MULTIPLE_INDEPENDENT_CONCERNS",
      severity: "high",
      message: "Two or more independent integrity checks raised material concerns.",
    });
  }
  return buildCheck(signals);
}

function decisionRank(decision: PreflightDecision): number {
  return { ALLOW: 0, VERIFY: 1, HOLD: 2, BLOCK: 3 }[decision];
}

function maxDecision(left: PreflightDecision, right: PreflightDecision): PreflightDecision {
  return decisionRank(left) >= decisionRank(right) ? left : right;
}

function decisionFromCheck(check: CheckResult): PreflightDecision {
  switch (check.status) {
    case "block": return "BLOCK";
    case "hold": return "HOLD";
    case "verify": return "VERIFY";
    default: return "ALLOW";
  }
}

function controlsForSignals(signals: PreflightSignal[]): string[] {
  const controls = new Set<string>();
  for (const signal of signals) {
    if (signal.code.includes("CLAIM")) controls.add("independent_evidence");
    if (signal.code.includes("STATE_CHANGE")) controls.add("verify_material_change");
    if (signal.code.includes("APPROVAL") || signal.code.includes("COMMITMENT")) controls.add("principal_approval");
    if (signal.code.includes("SPEND_LIMIT")) controls.add("principal_approval");
    if (signal.code.includes("NO_PRIOR_STATE")) controls.add("establish_baseline");
    if (signal.code.includes("AMOUNT") || signal.code.includes("CURRENCY")) controls.add("validate_transaction");
    if (signal.code.includes("AGGREGATE")) controls.add("review_recent_activity");
    if (signal.code.includes("SENSITIVE_DATA") || signal.code.includes("HIGH_PRIVILEGE")) controls.add("principal_approval");
  }
  return [...controls];
}

export function preflight(capsule: DecisionCapsule): PreflightResult {
  const change = runChangeGuard(capsule);
  const mandate = runMandateCheck(capsule);
  const commitment = runCommitmentGuard(capsule);
  const verify = runVerifyCheck(capsule);
  const challenge = runChallengeCheck(capsule, { change, mandate, commitment, verify });
  const checks = { change, mandate, commitment, verify, challenge };

  let decision: PreflightDecision = "ALLOW";
  for (const check of Object.values(checks)) {
    decision = maxDecision(decision, decisionFromCheck(check));
  }

  const signals = Object.values(checks).flatMap((check) => check.signals);
  const risk = clamp(1 - Math.exp(-signals.reduce((sum, signal) => sum + severityWeight(signal.severity), 0)));
  const required_controls = controlsForSignals(signals);

  const summary =
    decision === "ALLOW"
      ? "No material integrity condition requires intervention."
      : decision === "VERIFY"
        ? "Proceed only after the flagged uncertainty is independently verified."
        : decision === "HOLD"
          ? "Hold execution until the required control or principal approval is satisfied."
          : "The principal mandate blocks this action.";

  return {
    version: "0.1",
    decision,
    risk: Number(risk.toFixed(3)),
    checks,
    signals,
    required_controls,
    summary,
  };
}

export function isDecisionCapsule(value: unknown): value is DecisionCapsule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DecisionCapsule>;
  return !!candidate.proposed_action && typeof candidate.proposed_action.type === "string";
}
