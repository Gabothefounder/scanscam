import {
  preflight,
  type DecisionCapsule,
  type PreflightDecision,
  type PrincipalMandate,
} from "../lib/integrity/preflight";

type Category =
  | "change"
  | "mandate"
  | "commitment"
  | "verify"
  | "value"
  | "composition";

type BenchmarkCase = {
  id: string;
  category: Category;
  capsule: DecisionCapsule;
  expected: PreflightDecision;
  expected_signals?: string[];
  forbidden_signals?: string[];
  note: string;
};

const BASE_MANDATE: PrincipalMandate = {
  currency: "CAD",
  max_autonomous_amount: 2500,
  human_approval_amount: 2500,
  rules: [],
  objectives: [],
  budgets: [],
};

function capsule(
  action: DecisionCapsule["proposed_action"],
  extra: Omit<DecisionCapsule, "proposed_action"> = {}
): DecisionCapsule {
  return {
    version: "0.1",
    principal: {
      id: "benchmark-principal",
      mandate: BASE_MANDATE,
    },
    proposed_action: action,
    ...extra,
  };
}

function pay(amount = 300, destination = "bank:known"): DecisionCapsule["proposed_action"] {
  return {
    type: "transfer_funds",
    amount,
    currency: "CAD",
    counterparty_id: "counterparty:acme",
    destination,
    irreversible: true,
    creates_commitment: true,
  };
}

const RECENT = "2026-09-01T00:00:00.000Z";
const OLD = "2020-01-01T00:00:00.000Z";

const cases: BenchmarkCase[] = [
  // CHANGE — benign drift should be observable without creating friction.
  {
    id: "change-unchanged-routine",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { bank_account: "A", price: 100, country: "CA" } },
      current_state: { vendor: { bank_account: "A", price: 100, country: "CA" } },
    }),
    expected: "ALLOW",
    note: "Identical trusted state should not interrupt a routine action.",
  },
  {
    id: "change-nonsensitive-label",
    category: "change",
    capsule: capsule({ type: "send_message", counterparty_id: "counterparty:acme" }, {
      previous_state: { vendor: { display_label: "ACME Inc." } },
      current_state: { vendor: { display_label: "ACME Incorporated" } },
    }),
    expected: "ALLOW",
    expected_signals: ["STATE_CHANGE"],
    note: "Low-impact metadata drift is a notice, not an intervention.",
  },
  {
    id: "change-price-plus-5pct",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { price: 100 } },
      current_state: { vendor: { price: 105 } },
    }),
    expected: "ALLOW",
    expected_signals: ["STATE_CHANGE"],
    note: "Small price drift is logged without forcing verification.",
  },
  {
    id: "change-price-plus-10pct",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { price: 100 } },
      current_state: { vendor: { price: 110 } },
    }),
    expected: "ALLOW",
    expected_signals: ["STATE_CHANGE"],
    note: "Boundary case: ten percent price drift remains low severity.",
  },
  {
    id: "change-price-plus-20pct",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { price: 100 } },
      current_state: { vendor: { price: 120 } },
    }),
    expected: "ALLOW",
    expected_signals: ["STATE_CHANGE"],
    note: "Twenty percent price drift is a medium notice, not automatic verification.",
  },
  {
    id: "change-price-plus-21pct",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { price: 100 } },
      current_state: { vendor: { price: 121 } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "Material price jump should interrupt.",
  },
  {
    id: "change-new-fee-from-zero",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { fee: 0 } },
      current_state: { vendor: { fee: 1 } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "A newly introduced fee is materially different even if numerically small.",
  },
  {
    id: "change-bank-destination",
    category: "change",
    capsule: capsule(pay(300, "bank:new"), {
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:new" } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "Bank destination change is the core ChangeGuard wedge.",
  },
  {
    id: "change-domain",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { domain: "acme.ca" } },
      current_state: { vendor: { domain: "acme-payments.example" } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "Counterparty domain changes require verification.",
  },
  {
    id: "change-email",
    category: "change",
    capsule: capsule(pay(), {
      previous_state: { vendor: { email: "ap@acme.ca" } },
      current_state: { vendor: { email: "acme.payments@example.com" } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "Payment-context contact changes should interrupt.",
  },
  {
    id: "change-permission",
    category: "change",
    capsule: capsule({ type: "grant_access", creates_commitment: true }, {
      previous_state: { access: { role: "viewer" } },
      current_state: { access: { role: "admin" } },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    note: "Privilege expansion is a material state transition.",
  },
  {
    id: "change-first-counterparty-small",
    category: "change",
    capsule: capsule(pay(499), {
      previous_state: undefined,
      current_state: { vendor: { bank_account: "A" } },
    }),
    expected: "ALLOW",
    expected_signals: ["NO_PRIOR_STATE"],
    note: "First-time low-stake counterparty action is visible but not automatically blocked.",
  },
  {
    id: "change-first-counterparty-material",
    category: "change",
    capsule: capsule(pay(500), {
      previous_state: undefined,
      current_state: { vendor: { bank_account: "A" } },
    }),
    expected: "VERIFY",
    expected_signals: ["NO_PRIOR_STATE"],
    note: "First-time material financial action requires baseline establishment.",
  },
  {
    id: "change-first-counterparty-nonfinancial",
    category: "change",
    capsule: capsule({
      type: "send_message",
      counterparty_id: "counterparty:new",
      creates_commitment: false,
    }),
    expected: "ALLOW",
    expected_signals: ["NO_PRIOR_STATE"],
    note: "Unknown history alone should not halt a low-stake message.",
  },

  // MANDATE — explicit principal policy must dominate utility.
  {
    id: "mandate-missing-noncommitment",
    category: "mandate",
    capsule: {
      proposed_action: { type: "send_message" },
    },
    expected: "ALLOW",
    expected_signals: ["MANDATE_MISSING"],
    note: "Missing mandate is visible but generic low-risk work can continue.",
  },
  {
    id: "mandate-blocked-action",
    category: "mandate",
    capsule: capsule({ type: "publish" }, {
      principal: {
        id: "benchmark-principal",
        mandate: { ...BASE_MANDATE, blocked_action_types: ["publish"] },
      },
    }),
    expected: "BLOCK",
    expected_signals: ["BLOCK_ACTION_TYPE"],
    note: "Explicit never means never.",
  },
  {
    id: "mandate-approval-action",
    category: "mandate",
    capsule: capsule({ type: "book", amount: 200, currency: "CAD", counterparty_id: "airline" }, {
      principal: {
        id: "benchmark-principal",
        mandate: { ...BASE_MANDATE, approval_action_types: ["book"] },
      },
    }),
    expected: "VERIFY",
    expected_signals: ["MANDATE_APPROVAL_REQUIRED"],
    note: "Ask-first policy should interrupt but not hard-block.",
  },
  {
    id: "mandate-autonomous-limit",
    category: "mandate",
    capsule: capsule(pay(2501)),
    expected: "VERIFY",
    expected_signals: ["AUTONOMOUS_SPEND_LIMIT_EXCEEDED"],
    note: "Amount above autonomous scope requires the principal.",
  },
  {
    id: "mandate-human-threshold-equal",
    category: "mandate",
    capsule: capsule(pay(2500)),
    expected: "VERIFY",
    expected_signals: ["HUMAN_APPROVAL_THRESHOLD"],
    note: "Approval threshold is inclusive.",
  },
  {
    id: "mandate-below-threshold",
    category: "mandate",
    capsule: capsule(pay(2499), {
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:known" } },
    }),
    expected: "ALLOW",
    forbidden_signals: ["HUMAN_APPROVAL_THRESHOLD", "AUTONOMOUS_SPEND_LIMIT_EXCEEDED"],
    note: "One dollar below the threshold remains autonomous for an established unchanged counterparty.",
  },
  {
    id: "mandate-currency-mismatch",
    category: "mandate",
    capsule: capsule({
      ...pay(200),
      currency: "USD",
    }),
    expected: "VERIFY",
    expected_signals: ["CURRENCY_CONVERSION_REQUIRED"],
    note: "Limits cannot be safely applied across currencies without conversion.",
  },
  {
    id: "mandate-missing-amount",
    category: "mandate",
    capsule: capsule({
      type: "transfer_funds",
      currency: "CAD",
      counterparty_id: "counterparty:acme",
      destination: "bank:known",
    }),
    expected: "VERIFY",
    expected_signals: ["FINANCIAL_AMOUNT_MISSING"],
    note: "Financial actions need an amount before policy can evaluate them.",
  },
  {
    id: "mandate-missing-counterparty",
    category: "mandate",
    capsule: capsule({
      type: "transfer_funds",
      amount: 100,
      currency: "CAD",
    }),
    expected: "VERIFY",
    expected_signals: ["FINANCIAL_COUNTERPARTY_MISSING"],
    note: "Financial execution must identify a destination or counterparty.",
  },
  {
    id: "mandate-invalid-negative-amount",
    category: "mandate",
    capsule: capsule({
      type: "transfer_funds",
      amount: -1,
      currency: "CAD",
      counterparty_id: "counterparty:acme",
    }),
    expected: "VERIFY",
    expected_signals: ["INVALID_AMOUNT"],
    note: "Malformed economic semantics fail closed.",
  },
  {
    id: "mandate-aggregate-spend",
    category: "mandate",
    capsule: capsule(pay(100), {
      context: { aggregate_amount_last_hour: 2500 },
    }),
    expected: "VERIFY",
    expected_signals: ["AGGREGATE_SPEND_THRESHOLD"],
    note: "Many individually small actions cannot evade aggregate review.",
  },
  {
    id: "mandate-custom-block-rule",
    category: "mandate",
    capsule: capsule(pay(100), {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          rules: [{
            id: "excluded-vendor",
            field: "context.vendor_policy",
            operator: "eq",
            value: "never",
            effect: "block",
          }],
        },
      },
      context: { vendor_policy: "never" },
    }),
    expected: "BLOCK",
    expected_signals: ["BLOCK_EXCLUDED_VENDOR"],
    note: "Domain-specific hard rules must remain hard.",
  },
  {
    id: "mandate-custom-approval-rule",
    category: "mandate",
    capsule: capsule({ type: "book", amount: 300, currency: "CAD", counterparty_id: "airline" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          rules: [{
            id: "red-eye",
            field: "context.flight.red_eye",
            operator: "eq",
            value: true,
            effect: "require_approval",
          }],
        },
      },
      context: { flight: { red_eye: true } },
    }),
    expected: "VERIFY",
    expected_signals: ["MANDATE_RED_EYE"],
    note: "Ask-first domain rule stays distinct from deny.",
  },
  {
    id: "mandate-rule-not-matched",
    category: "mandate",
    capsule: capsule({ type: "book", amount: 300, currency: "CAD", counterparty_id: "airline" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          rules: [{
            id: "red-eye",
            field: "context.flight.red_eye",
            operator: "eq",
            value: true,
            effect: "require_approval",
          }],
        },
      },
      context: { flight: { red_eye: false } },
    }),
    expected: "ALLOW",
    forbidden_signals: ["MANDATE_RED_EYE"],
    note: "A hard rule that does not match must not create friction.",
  },

  // COMMITMENT — authorization to bind the principal is separate from intelligence.
  {
    id: "commitment-routine-payment",
    category: "commitment",
    capsule: capsule(pay(300)),
    expected: "ALLOW",
    expected_signals: ["PRINCIPAL_COMMITMENT", "IRREVERSIBLE_ACTION"],
    note: "Routine bounded payment is a commitment but does not automatically require intervention.",
  },
  {
    id: "commitment-without-mandate",
    category: "commitment",
    capsule: {
      proposed_action: {
        type: "sign_contract",
        creates_commitment: true,
      },
    },
    expected: "VERIFY",
    expected_signals: ["COMMITMENT_WITHOUT_MANDATE"],
    note: "An agent cannot bind an undefined principal policy.",
  },
  {
    id: "commitment-sign-contract-unclear",
    category: "commitment",
    capsule: capsule({
      type: "sign_contract",
      creates_commitment: true,
    }),
    expected: "VERIFY",
    expected_signals: ["COMMITMENT_SCOPE_UNCLEAR"],
    note: "Contract signature needs explicit scope.",
  },
  {
    id: "commitment-sign-contract-explicit-ask",
    category: "commitment",
    capsule: capsule({
      type: "sign_contract",
      creates_commitment: true,
    }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          approval_action_types: ["sign_contract"],
        },
      },
    }),
    expected: "VERIFY",
    expected_signals: ["MANDATE_APPROVAL_REQUIRED"],
    forbidden_signals: ["COMMITMENT_SCOPE_UNCLEAR"],
    note: "Explicit ask-first scope removes ambiguity while still requiring the principal.",
  },
  {
    id: "commitment-promise-refund",
    category: "commitment",
    capsule: capsule({
      type: "promise_refund",
      amount: 100,
      currency: "CAD",
      creates_commitment: true,
    }),
    expected: "VERIFY",
    expected_signals: ["COMMITMENT_SCOPE_UNCLEAR"],
    note: "Agent-created financial promises are binding commitments.",
  },
  {
    id: "commitment-accept-fee",
    category: "commitment",
    capsule: capsule({
      type: "accept_fee",
      amount: 50,
      currency: "CAD",
      creates_commitment: true,
    }),
    expected: "VERIFY",
    expected_signals: ["COMMITMENT_SCOPE_UNCLEAR"],
    note: "A counterparty cannot insert a fee the agent silently accepts.",
  },
  {
    id: "commitment-unknown-binding-action",
    category: "commitment",
    capsule: capsule({
      type: "custom_partner_action",
      creates_commitment: true,
    }),
    expected: "VERIFY",
    expected_signals: ["COMMITMENT_SCOPE_UNCLEAR"],
    note: "Unknown tool names cannot bypass commitment policy.",
  },
  {
    id: "commitment-semantic-legal-effect",
    category: "commitment",
    capsule: capsule({
      type: "custom_partner_action",
      creates_commitment: false,
      metadata: { legal_effect: "binding commercial obligation" },
    }),
    expected: "VERIFY",
    expected_signals: ["SEMANTIC_BINDING_EFFECT"],
    note: "Semantic binding metadata catches innocuous tool names.",
  },
  {
    id: "commitment-admin-access",
    category: "commitment",
    capsule: capsule({
      type: "custom_access_action",
      metadata: { permission: "admin", target: "production-workspace" },
    }),
    expected: "VERIFY",
    expected_signals: ["HIGH_PRIVILEGE_ACCESS"],
    note: "High privilege requires review even if the action label is evasive.",
  },
  {
    id: "commitment-public-confidential-data",
    category: "commitment",
    capsule: capsule({
      type: "publish",
      metadata: { contains_personal_data: true },
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_DATA_PUBLICATION"],
    note: "Sensitive public release must interrupt.",
  },
  {
    id: "commitment-normal-message",
    category: "commitment",
    capsule: capsule({
      type: "send_message",
      counterparty_id: "counterparty:acme",
      creates_commitment: false,
    }, {
      previous_state: { contact: { email: "ap@acme.ca" } },
      current_state: { contact: { email: "ap@acme.ca" } },
    }),
    expected: "ALLOW",
    note: "Low-stake reversible communication should not inherit commitment friction.",
  },

  // VERIFY — truth/provenance only matters for material premises.
  {
    id: "verify-material-no-evidence",
    category: "verify",
    capsule: capsule(pay(300), {
      claims: [{
        text: "Counterparty payment instructions changed.",
        material: true,
        evidence: [],
      }],
    }),
    expected: "VERIFY",
    expected_signals: ["MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED"],
    note: "Material premise cannot justify action without independent evidence.",
  },
  {
    id: "verify-material-self-asserted",
    category: "verify",
    capsule: capsule(pay(300), {
      claims: [{
        text: "Counterparty payment instructions changed.",
        material: true,
        evidence: [{ source: "vendor-email", verified: true, independent: false, observed_at: RECENT }],
      }],
    }),
    expected: "VERIFY",
    expected_signals: ["MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED"],
    note: "Verified provenance is not enough if it is not independent.",
  },
  {
    id: "verify-material-independent",
    category: "verify",
    capsule: capsule(pay(300), {
      claims: [{
        text: "Counterparty payment instructions changed.",
        material: true,
        evidence: [{ source: "registry", verified: true, independent: true, observed_at: RECENT }],
      }],
    }),
    expected: "ALLOW",
    forbidden_signals: ["MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED", "EVIDENCE_STALE"],
    note: "Independent recent evidence satisfies the primitive.",
  },
  {
    id: "verify-current-claim-stale",
    category: "verify",
    capsule: capsule(pay(300), {
      claims: [{
        text: "The bank account is currently authorized.",
        material: true,
        evidence: [{ source: "registry", verified: true, independent: true, observed_at: OLD }],
      }],
    }),
    expected: "VERIFY",
    expected_signals: ["EVIDENCE_STALE"],
    note: "Freshness-sensitive claims cannot rely on stale evidence.",
  },
  {
    id: "verify-current-claim-recent",
    category: "verify",
    capsule: capsule(pay(300), {
      claims: [{
        text: "The bank account is currently authorized.",
        material: true,
        evidence: [{ source: "registry", verified: true, independent: true, observed_at: RECENT }],
      }],
    }),
    expected: "ALLOW",
    forbidden_signals: ["EVIDENCE_STALE"],
    note: "Recent independent evidence is sufficient.",
  },
  {
    id: "verify-nonfresh-claim-old-evidence",
    category: "verify",
    capsule: capsule({ type: "send_message" }, {
      claims: [{
        text: "ACME was founded in 1987.",
        material: true,
        evidence: [{ source: "corporate-record", verified: true, independent: true, observed_at: OLD }],
      }],
    }),
    expected: "ALLOW",
    forbidden_signals: ["EVIDENCE_STALE"],
    note: "Historical facts do not require artificial freshness.",
  },
  {
    id: "verify-immaterial-claim",
    category: "verify",
    capsule: capsule({ type: "send_message" }, {
      claims: [{
        text: "The vendor logo is blue.",
        material: false,
        evidence: [],
      }],
    }),
    expected: "ALLOW",
    forbidden_signals: ["MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED"],
    note: "Immaterial claims must not create evidence work.",
  },

  // VALUE — soft utility must not mutate enforcement.
  {
    id: "value-preference-match",
    category: "value",
    capsule: capsule({ type: "send_message" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          objectives: [{
            id: "prefer-canada",
            field: "context.supplier_country",
            operator: "eq",
            value: "CA",
            mode: "prefer",
            weight: 80,
            private: true,
          }],
        },
      },
      context: { supplier_country: "CA" },
    }),
    expected: "ALLOW",
    expected_signals: ["VALUE_PREFERENCE_MATCH"],
    note: "Preference match changes utility, not authorization.",
  },
  {
    id: "value-avoid-match",
    category: "value",
    capsule: capsule({ type: "send_message" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          objectives: [{
            id: "avoid-data-sale",
            field: "context.sells_personal_data",
            operator: "eq",
            value: true,
            mode: "avoid",
            weight: 100,
            private: true,
          }],
        },
      },
      context: { sells_personal_data: true },
    }),
    expected: "ALLOW",
    expected_signals: ["VALUE_AVOID_MATCH"],
    note: "Even a very strong avoid preference remains soft unless promoted to a hard rule.",
  },
  {
    id: "value-soft-does-not-outvote-block",
    category: "value",
    capsule: capsule({ type: "publish" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          blocked_action_types: ["publish"],
          objectives: [{
            id: "love-publication",
            field: "action.type",
            operator: "eq",
            value: "publish",
            mode: "prefer",
            weight: 100,
            private: true,
          }],
        },
      },
    }),
    expected: "BLOCK",
    expected_signals: ["BLOCK_ACTION_TYPE", "VALUE_PREFERENCE_MATCH"],
    note: "Utility cannot outvote an explicit hard boundary.",
  },

  // COMPOSITION — multiple weak/strong concerns should combine predictably.
  {
    id: "composition-two-material-concerns",
    category: "composition",
    capsule: capsule(pay(300, "bank:new"), {
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:new" } },
      claims: [{
        text: "Counterparty payment instructions changed.",
        material: true,
        evidence: [],
      }],
    }),
    expected: "VERIFY",
    expected_signals: [
      "SENSITIVE_STATE_CHANGE",
      "MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED",
      "MULTIPLE_INDEPENDENT_CONCERNS",
    ],
    note: "Independent concerns should reinforce one another.",
  },
  {
    id: "composition-block-dominates-verification",
    category: "composition",
    capsule: capsule(pay(300, "bank:new"), {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          blocked_action_types: ["transfer_funds"],
        },
      },
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:new" } },
    }),
    expected: "BLOCK",
    expected_signals: ["BLOCK_ACTION_TYPE", "SENSITIVE_STATE_CHANGE"],
    note: "A hard block dominates any lesser intervention.",
  },
  {
    id: "composition-approval-plus-change",
    category: "composition",
    capsule: capsule(pay(2500, "bank:new"), {
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:new" } },
    }),
    expected: "VERIFY",
    expected_signals: ["HUMAN_APPROVAL_THRESHOLD", "SENSITIVE_STATE_CHANGE"],
    note: "Primitive-level output stays VERIFY; runtime later maps approval semantics separately.",
  },
  {
    id: "composition-benign-value-plus-small-drift",
    category: "composition",
    capsule: capsule({ type: "send_message" }, {
      principal: {
        id: "benchmark-principal",
        mandate: {
          ...BASE_MANDATE,
          objectives: [{
            id: "prefer-canada",
            field: "context.supplier_country",
            operator: "eq",
            value: "CA",
            mode: "prefer",
            weight: 90,
            private: true,
          }],
        },
      },
      previous_state: { vendor: { price: 100 } },
      current_state: { vendor: { price: 105 } },
      context: { supplier_country: "CA" },
    }),
    expected: "ALLOW",
    expected_signals: ["VALUE_PREFERENCE_MATCH", "STATE_CHANGE"],
    note: "Multiple notices are not automatically an interruption.",
  },
  {
    id: "composition-irreversible-alone",
    category: "composition",
    capsule: capsule({
      type: "custom_irreversible",
      irreversible: true,
      creates_commitment: false,
    }),
    expected: "ALLOW",
    expected_signals: ["IRREVERSIBLE_ACTION"],
    note: "Irreversibility alone triggers receipt discipline, not blanket human review.",
  },
  {
    id: "composition-sensitive-change-verified-claim",
    category: "composition",
    capsule: capsule(pay(300, "bank:new"), {
      previous_state: { vendor: { bank_account: "bank:known" } },
      current_state: { vendor: { bank_account: "bank:new" } },
      claims: [{
        text: "Counterparty payment instructions changed.",
        material: true,
        evidence: [{ source: "independent-callback", verified: true, independent: true, observed_at: RECENT }],
      }],
    }),
    expected: "VERIFY",
    expected_signals: ["SENSITIVE_STATE_CHANGE"],
    forbidden_signals: ["MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED"],
    note: "Base primitive still observes the change; v0.5 runtime is responsible for applying verified-change evidence.",
  },
];

type CaseResult = {
  id: string;
  category: Category;
  expected: PreflightDecision;
  actual: PreflightDecision;
  passed: boolean;
  signal_passed: boolean;
  dangerous_miss: boolean;
  over_intervention: boolean;
  missing_signals: string[];
  forbidden_signals_present: string[];
  risk: number;
  note: string;
};

const results: CaseResult[] = cases.map((test) => {
  const result = preflight(test.capsule);
  const codes = new Set(result.signals.map((signal) => signal.code));
  const missingSignals = (test.expected_signals ?? []).filter((code) => !codes.has(code));
  const forbiddenPresent = (test.forbidden_signals ?? []).filter((code) => codes.has(code));
  const signalPassed = missingSignals.length === 0 && forbiddenPresent.length === 0;
  const passed = result.decision === test.expected && signalPassed;

  return {
    id: test.id,
    category: test.category,
    expected: test.expected,
    actual: result.decision,
    passed,
    signal_passed: signalPassed,
    dangerous_miss: test.expected !== "ALLOW" && result.decision === "ALLOW",
    over_intervention: test.expected === "ALLOW" && result.decision !== "ALLOW",
    missing_signals: missingSignals,
    forbidden_signals_present: forbiddenPresent,
    risk: result.risk,
    note: test.note,
  };
});

const categories = [...new Set(cases.map((item) => item.category))];
const byCategory = Object.fromEntries(
  categories.map((category) => {
    const subset = results.filter((result) => result.category === category);
    const passed = subset.filter((result) => result.passed).length;
    return [category, {
      total: subset.length,
      passed,
      failed: subset.length - passed,
      accuracy: Number((passed / subset.length).toFixed(3)),
      dangerous_misses: subset.filter((result) => result.dangerous_miss).length,
      over_interventions: subset.filter((result) => result.over_intervention).length,
    }];
  })
);

const passed = results.filter((result) => result.passed).length;
const dangerousMisses = results.filter((result) => result.dangerous_miss);
const overInterventions = results.filter((result) => result.over_intervention);
const failures = results.filter((result) => !result.passed);

const report = {
  suite: "integrity-primitives-benchmark-v0.8",
  total: results.length,
  passed,
  failed: results.length - passed,
  exact_accuracy: Number((passed / results.length).toFixed(3)),
  dangerous_misses: dangerousMisses.length,
  over_interventions: overInterventions.length,
  by_category: byCategory,
  failures,
};

console.log(JSON.stringify(report, null, 2));

if (failures.length) process.exit(1);
