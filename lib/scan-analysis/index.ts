/**
 * Shared scan analysis module.
 * Single entry point: analyzeScan(input) -> ScanAnalysisResult
 *
 * NOT wired into production yet.
 */

import type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
import { assessContextQuality, routeSubmission } from "./router";
import { extract } from "./extract";
import { computeRisk } from "./risk";
import { explain } from "./explain";

export type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
export * from "./taxonomy";
export { assessContextQuality, routeSubmission } from "./router";

export function analyzeScan(input: ScanAnalysisInput): ScanAnalysisResult {
  const { messageText, source } = input;

  const trimmed = messageText.trim();
  const contextQuality = assessContextQuality({ messageText: trimmed });
  const submissionRoute = routeSubmission({ messageText: trimmed });

  const extractResult = extract({
    messageText: trimmed.toLowerCase(),
    contextQuality,
  });

  const riskResult = computeRisk({
    riskTierFromAi: "low",
    submissionRoute,
    narrativeFamily: extractResult.narrativeFamily,
    threatStage: extractResult.threatStage,
  });

  const summary = explain({
    riskTier: riskResult.riskTier,
    narrativeFamily: extractResult.narrativeFamily,
    threatStage: extractResult.threatStage,
  });

  return {
    riskTier: riskResult.riskTier,
    riskScore: riskResult.riskScore,
    summary,
    submissionRoute,
    narrativeFamily: extractResult.narrativeFamily,
    impersonationEntity: extractResult.impersonationEntity,
    requestedAction: extractResult.requestedAction,
    threatStage: extractResult.threatStage,
    confidenceLevel: "low",
    sourceType: source,
    contextQuality,
  };
}
