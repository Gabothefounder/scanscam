import { shouldRunIntegritySemantic } from "../lib/integrity/semantic-gate";
import type { ActionEnvelope } from "../lib/integrity/action-envelope";
import type { PreflightSignal } from "../lib/integrity/preflight";

type Case = {
  id: string;
  effect: ActionEnvelope["effect"];
  signals: PreflightSignal[];
  expected: boolean;
};

const medium = (code: string): PreflightSignal => ({
  code,
  severity: "medium",
  message: code,
});

const high = (code: string): PreflightSignal => ({
  code,
  severity: "high",
  message: code,
});

const cases: Case[] = [
  {
    id: "verified-destination-change-does-not-retrigger-semantics",
    effect: "financial_transfer",
    signals: [
      medium("VERIFIED_STATE_CHANGE"),
      medium("VERIFIED_DESTINATION_CHANGE_CLAIM"),
      medium("PRINCIPAL_COMMITMENT"),
      medium("IRREVERSIBLE_ACTION"),
    ],
    expected: false,
  },
  {
    id: "verified-domain-change-does-not-retrigger-semantics",
    effect: "financial_transfer",
    signals: [
      medium("VERIFIED_STATE_CHANGE"),
      medium("PRINCIPAL_COMMITMENT"),
      medium("IRREVERSIBLE_ACTION"),
    ],
    expected: false,
  },
  {
    id: "deterministic-interrupt-skips-semantics",
    effect: "financial_transfer",
    signals: [high("MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED")],
    expected: false,
  },
  {
    id: "unknown-effect-still-requires-semantics",
    effect: "unknown",
    signals: [],
    expected: true,
  },
  {
    id: "multiple-unresolved-medium-concerns-still-trigger-semantics",
    effect: "purchase",
    signals: [
      medium("UNRESOLVED_A"),
      medium("UNRESOLVED_B"),
      medium("UNRESOLVED_C"),
      medium("UNRESOLVED_D"),
    ],
    expected: true,
  },
  {
    id: "single-urgency-not-enough-for-semantic-escalation",
    effect: "financial_transfer",
    signals: [medium("DECEPTION_PRESSURE_URGENCY")],
    expected: false,
  },
];

const results = cases.map((item) => {
  const actual = shouldRunIntegritySemantic(
    { effect: item.effect },
    item.signals
  );
  return {
    id: item.id,
    expected: item.expected,
    actual,
    passed: actual === item.expected,
  };
});

const failed = results.filter((item) => !item.passed);

process.stdout.write(JSON.stringify({
  suite: "integrity-semantic-gate-v0.10",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2) + "\n");

if (failed.length) process.exit(1);
