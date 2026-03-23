/**
 * Risk scoring and tier derivation.
 */

import type { RiskTier } from "./taxonomy";

export type RiskInput = {
  riskTierFromAi: RiskTier;
  submissionRoute: string;
  narrativeFamily: string;
  threatStage: string;
};

export type RiskResult = {
  riskTier: RiskTier;
  riskScore: number;
};

export function computeRisk(input: RiskInput): RiskResult {
  const { riskTierFromAi } = input;

  const riskScore =
    riskTierFromAi === "high" ? 85 : riskTierFromAi === "medium" ? 50 : 15;

  return {
    riskTier: riskTierFromAi,
    riskScore,
  };
}
