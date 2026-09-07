import {
  preflight,
  type DecisionCapsule,
  type PreflightDecision,
  type PrincipalMandate,
} from "../lib/integrity/preflight";

const rank: Record<PreflightDecision, number> = {
  ALLOW: 0,
  VERIFY: 1,
  HOLD: 2,
  BLOCK: 3,
};

type Assertion = {
  id: string;
  passed: boolean;
  detail: string;
};

const assertions: Assertion[] = [];

function assertProperty(id: string, passed: boolean, detail: string) {
  assertions.push({ id, passed, detail });
}

const MANDATE: PrincipalMandate = {
  currency: "CAD",
  max_autonomous_amount: 2500,
  human_approval_amount: 2500,
  rules: [],
  objectives: [],
  budgets: [],
};

function establishedPayment(amount: number, destination = "bank:A"): DecisionCapsule {
  return {
    principal: { id: "p", mandate: MANDATE },
    proposed_action: {
      type: "transfer_funds",
      amount,
      currency: "CAD",
      counterparty_id: "counterparty:acme",
      destination,
      irreversible: true,
      creates_commitment: true,
    },
    previous_state: {
      vendor: { bank_account: "bank:A", price: 100 },
    },
    current_state: {
      vendor: { bank_account: destination, price: 100 },
    },
  };
}

// 1. Hard blocks are absolute across amounts and soft objectives.
for (const amount of [0, 1, 100, 2499, 2500, 10000]) {
  const capsule = establishedPayment(amount);
  capsule.principal = {
    id: "p",
    mandate: {
      ...MANDATE,
      blocked_action_types: ["transfer_funds"],
      objectives: [{
        id: "prefer-this-exact-action",
        field: "action.type",
        operator: "eq",
        value: "transfer_funds",
        mode: "prefer",
        weight: 100,
        private: true,
      }],
    },
  };
  const result = preflight(capsule);
  assertProperty(
    `hard-block-absolute-${amount}`,
    result.decision === "BLOCK",
    `amount=${amount}; decision=${result.decision}`
  );
}

// 2. A soft value objective must never increase enforcement severity by itself.
for (const weight of [0, 1, 20, 50, 100, 500]) {
  const base: DecisionCapsule = {
    principal: { id: "p", mandate: MANDATE },
    proposed_action: { type: "send_message" },
    context: { supplier_country: "CA" },
  };
  const baseDecision = preflight(base).decision;

  const withPreference: DecisionCapsule = {
    ...base,
    principal: {
      id: "p",
      mandate: {
        ...MANDATE,
        objectives: [{
          id: "prefer-canada",
          field: "context.supplier_country",
          operator: "eq",
          value: "CA",
          mode: "prefer",
          weight,
          private: true,
        }],
      },
    },
  };
  const preferenceDecision = preflight(withPreference).decision;
  assertProperty(
    `soft-preference-no-enforcement-${weight}`,
    rank[preferenceDecision] === rank[baseDecision],
    `weight=${weight}; base=${baseDecision}; with_preference=${preferenceDecision}`
  );
}

// 3. Bank destination change must never become less than VERIFY.
for (const amount of [1, 10, 100, 499, 500, 2499]) {
  const result = preflight(establishedPayment(amount, "bank:B"));
  assertProperty(
    `bank-change-min-verify-${amount}`,
    rank[result.decision] >= rank.VERIFY,
    `amount=${amount}; decision=${result.decision}`
  );
}

// 4. Unchanged destination must never be more restrictive than the changed destination.
for (const amount of [1, 100, 499, 500, 2499]) {
  const same = preflight(establishedPayment(amount, "bank:A")).decision;
  const changed = preflight(establishedPayment(amount, "bank:B")).decision;
  assertProperty(
    `bank-change-monotonic-${amount}`,
    rank[changed] >= rank[same],
    `amount=${amount}; same=${same}; changed=${changed}`
  );
}

// 5. Price-change severity must be monotonic as drift grows.
const priceDrifts = [0, 1, 5, 10, 20, 21, 50, 100];
let priorRank = -1;
for (const drift of priceDrifts) {
  const c = establishedPayment(300);
  c.previous_state = { vendor: { bank_account: "bank:A", price: 100 } };
  c.current_state = { vendor: { bank_account: "bank:A", price: 100 + drift } };
  const decision = preflight(c).decision;
  const currentRank = rank[decision];
  assertProperty(
    `price-drift-monotonic-${drift}`,
    currentRank >= priorRank,
    `drift=${drift}%; prior_rank=${priorRank}; decision=${decision}`
  );
  priorRank = currentRank;
}

// 6. Crossing the human approval threshold cannot reduce severity.
const thresholdAmounts = [0, 1, 2499, 2500, 2501, 10000];
let priorThresholdRank = -1;
for (const amount of thresholdAmounts) {
  const decision = preflight(establishedPayment(amount)).decision;
  const currentRank = rank[decision];
  assertProperty(
    `amount-threshold-monotonic-${amount}`,
    currentRank >= priorThresholdRank,
    `amount=${amount}; prior_rank=${priorThresholdRank}; decision=${decision}`
  );
  priorThresholdRank = currentRank;
}

// 7. Adding independent verified evidence cannot make a material-claim decision worse.
for (const claimText of [
  "Counterparty ownership changed.",
  "The bank account is currently authorized.",
  "The supplier is currently active.",
]) {
  const without: DecisionCapsule = establishedPayment(300);
  without.claims = [{ text: claimText, material: true, evidence: [] }];

  const withEvidence: DecisionCapsule = establishedPayment(300);
  withEvidence.claims = [{
    text: claimText,
    material: true,
    evidence: [{
      source: "independent-registry",
      verified: true,
      independent: true,
      observed_at: "2026-09-01T00:00:00.000Z",
    }],
  }];

  const before = preflight(without).decision;
  const after = preflight(withEvidence).decision;
  assertProperty(
    `evidence-nonworsening-${claimText.replace(/[^a-z]+/gi, "-").toLowerCase()}`,
    rank[after] <= rank[before],
    `claim=${claimText}; without=${before}; with_evidence=${after}`
  );
}

// 8. Replacing independent evidence with self-asserted evidence cannot reduce severity.
for (const claimText of [
  "Counterparty payment instructions changed.",
  "The bank account is currently authorized.",
]) {
  const independent = establishedPayment(300);
  independent.claims = [{
    text: claimText,
    material: true,
    evidence: [{
      source: "registry",
      verified: true,
      independent: true,
      observed_at: "2026-09-01T00:00:00.000Z",
    }],
  }];

  const selfAsserted = establishedPayment(300);
  selfAsserted.claims = [{
    text: claimText,
    material: true,
    evidence: [{
      source: "counterparty-email",
      verified: true,
      independent: false,
      observed_at: "2026-09-01T00:00:00.000Z",
    }],
  }];

  const good = preflight(independent).decision;
  const weak = preflight(selfAsserted).decision;
  assertProperty(
    `independence-monotonic-${claimText.replace(/[^a-z]+/gi, "-").toLowerCase()}`,
    rank[weak] >= rank[good],
    `claim=${claimText}; independent=${good}; self_asserted=${weak}`
  );
}

// 9. Explicit block is more restrictive than ask-first for the same condition.
for (const value of ["US", "RU", "XY"]) {
  const base = establishedPayment(100);
  base.context = { supplier_country: value };

  const approval: DecisionCapsule = {
    ...base,
    principal: {
      id: "p",
      mandate: {
        ...MANDATE,
        rules: [{
          id: "country-rule",
          field: "context.supplier_country",
          operator: "eq",
          value,
          effect: "require_approval",
        }],
      },
    },
  };

  const blocked: DecisionCapsule = {
    ...base,
    principal: {
      id: "p",
      mandate: {
        ...MANDATE,
        rules: [{
          id: "country-rule",
          field: "context.supplier_country",
          operator: "eq",
          value,
          effect: "block",
        }],
      },
    },
  };

  const askDecision = preflight(approval).decision;
  const blockDecision = preflight(blocked).decision;
  assertProperty(
    `block-stronger-than-approval-${value}`,
    rank[blockDecision] > rank[askDecision] && blockDecision === "BLOCK",
    `country=${value}; approval=${askDecision}; block=${blockDecision}`
  );
}

// 10. Removing an explicit commitment approval scope cannot make a binding action less restrictive.
for (const actionType of ["sign_contract", "accept_fee", "promise_refund"] as const) {
  const scoped: DecisionCapsule = {
    principal: {
      id: "p",
      mandate: {
        ...MANDATE,
        approval_action_types: [actionType],
      },
    },
    proposed_action: {
      type: actionType,
      amount: actionType === "sign_contract" ? undefined : 100,
      currency: "CAD",
      creates_commitment: true,
    },
  };
  const unclear: DecisionCapsule = {
    principal: { id: "p", mandate: MANDATE },
    proposed_action: { ...scoped.proposed_action },
  };

  const scopedDecision = preflight(scoped).decision;
  const unclearDecision = preflight(unclear).decision;
  assertProperty(
    `commitment-scope-nonweakening-${actionType}`,
    rank[unclearDecision] >= rank[scopedDecision],
    `action=${actionType}; explicit_ask=${scopedDecision}; unclear=${unclearDecision}`
  );
}

// 11. Irrelevant context must not alter a low-risk decision.
for (const noise of [
  { ui_theme: "dark" },
  { random_label: "hello" },
  { pagination: { page: 4, size: 20 } },
  { display: { locale: "fr-CA", density: "compact" } },
]) {
  const base: DecisionCapsule = {
    principal: { id: "p", mandate: MANDATE },
    proposed_action: { type: "send_message" },
  };
  const noisy: DecisionCapsule = { ...base, context: noise as any };
  const a = preflight(base).decision;
  const b = preflight(noisy).decision;
  assertProperty(
    `irrelevant-context-stability-${JSON.stringify(noise)}`,
    a === b,
    `base=${a}; noisy=${b}`
  );
}

// 12. Private/public flag of the same soft preference cannot change enforcement.
for (const privateFlag of [true, false]) {
  const c: DecisionCapsule = {
    principal: {
      id: "p",
      mandate: {
        ...MANDATE,
        objectives: [{
          id: "prefer-canada",
          field: "context.supplier_country",
          operator: "eq",
          value: "CA",
          mode: "prefer",
          weight: 100,
          private: privateFlag,
        }],
      },
    },
    proposed_action: { type: "send_message" },
    context: { supplier_country: "CA" },
  };
  const result = preflight(c);
  assertProperty(
    `preference-privacy-no-enforcement-${privateFlag}`,
    result.decision === "ALLOW",
    `private=${privateFlag}; decision=${result.decision}`
  );
}

const failed = assertions.filter((item) => !item.passed);

console.log(JSON.stringify({
  suite: "integrity-metamorphic-invariants-v0.8",
  total: assertions.length,
  passed: assertions.length - failed.length,
  failed: failed.length,
  pass_rate: assertions.length
    ? Number(((assertions.length - failed.length) / assertions.length).toFixed(3))
    : 0,
  failures: failed,
}, null, 2));

if (failed.length) process.exit(1);
