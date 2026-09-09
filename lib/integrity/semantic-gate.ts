import type { ActionEnvelope } from "./action-envelope";
import type { PreflightSignal } from "./preflight";

export type SemanticGateDisposition =
  | "ALLOW"
  | "CHALLENGE"
  | "APPROVAL_REQUIRED"
  | "DENY";

const RESOLVED_OR_EXPECTED_SIGNAL_CODES = new Set([
  "VERIFIED_STATE_CHANGE",
  "VERIFIED_DESTINATION_CHANGE_CLAIM",
  "VERIFIED_OWNERSHIP_CHANGE_CLAIM",
  "PRINCIPAL_COMMITMENT",
  "IRREVERSIBLE_ACTION",
]);

function dispositionForGate(
  signals: PreflightSignal[]
): SemanticGateDisposition {
  if (signals.some((signal) => signal.code.startsWith("BLOCK_"))) return "DENY";

  const approvalCodes = new Set([
    "MANDATE_APPROVAL_REQUIRED",
    "HUMAN_APPROVAL_THRESHOLD",
    "AUTONOMOUS_SPEND_LIMIT_EXCEEDED",
    "COMMITMENT_SCOPE_UNCLEAR",
  ]);

  if (
    signals.some((signal) =>
      approvalCodes.has(signal.code) ||
      (signal.code.startsWith("MANDATE_") && signal.severity === "high")
    )
  ) return "APPROVAL_REQUIRED";

  if (
    signals.some((signal) =>
      signal.severity === "high" || signal.severity === "critical"
    )
  ) return "CHALLENGE";

  return "ALLOW";
}

function unresolvedInterventionScore(signals: PreflightSignal[]): number {
  const weights: Record<PreflightSignal["severity"], number> = {
    info: 0.02,
    low: 0.08,
    medium: 0.2,
    high: 0.4,
    critical: 0.7,
  };

  const total = signals
    .filter((signal) => !signal.code.startsWith("VALUE_"))
    .filter((signal) => !RESOLVED_OR_EXPECTED_SIGNAL_CODES.has(signal.code))
    .reduce((sum, signal) => sum + weights[signal.severity], 0);

  return Number(Math.min(1, 1 - Math.exp(-total)).toFixed(3));
}

/**
 * Decide whether an otherwise-allowable action still needs semantic inspection.
 *
 * Trusted evidence is applied before this function is called. Signals that
 * represent a satisfied control (for example VERIFIED_STATE_CHANGE) or an
 * expected consequence of an already-understood action (for example
 * PRINCIPAL_COMMITMENT) must not re-trigger semantic review by themselves.
 *
 * Unknown effects always need semantic normalization. Deterministic interrupts
 * never spend semantic latency because execution is already safely stopped.
 */
export function shouldRunIntegritySemantic(
  envelope: Pick<ActionEnvelope, "effect">,
  deterministicSignals: PreflightSignal[]
): boolean {
  if (envelope.effect === "unknown") return true;

  if (dispositionForGate(deterministicSignals) !== "ALLOW") return false;

  return unresolvedInterventionScore(deterministicSignals) >= 0.55;
}
