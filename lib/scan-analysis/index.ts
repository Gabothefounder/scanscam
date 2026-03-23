/**
 * Rule-based scan enrichment module.
 * buildScanEnrichment() adds taxonomy and trust-floor metadata alongside AI analysis.
 *
 * Enrichment layer only; does not replace lib/ai/analyzeScan.
 * Used by /api/scan; AI remains canonical for risk/summary/signals.
 */

import type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
import { assessContextQuality, routeSubmission } from "./router";
import { extract } from "./extract";
import { computeRisk } from "./risk";
import { explain } from "./explain";

export type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
export * from "./taxonomy";
export { assessContextQuality, routeSubmission } from "./router";

/**
 * Rule-based enrichment: taxonomy + trust-floor metadata.
 * Complements lib/ai/analyzeScan; does not replace it.
 */
export function buildScanEnrichment(input: ScanAnalysisInput): ScanAnalysisResult {
  // 1. Normalize input basics
  const messageText = (input.messageText ?? "").trim();
  const sourceType = input.source;

  // 2–4. Context and routing
  const contextQuality = assessContextQuality({ messageText });
  const submissionRoute = routeSubmission({ messageText });

  // 5. Extraction
  const extractResult = extract({
    messageText: messageText.toLowerCase(),
    contextQuality,
    submissionRoute,
  });

  // 6. Risk and confidence
  const riskResult = computeRisk({
    submissionRoute,
    narrativeFamily: extractResult.narrativeFamily,
    impersonationEntity: extractResult.impersonationEntity,
    requestedAction: extractResult.requestedAction,
    threatStage: extractResult.threatStage,
    contextQuality,
  });

  // 7. Summary
  const summary = explain({
    submissionRoute,
    narrativeFamily: extractResult.narrativeFamily,
    impersonationEntity: extractResult.impersonationEntity,
    requestedAction: extractResult.requestedAction,
    threatStage: extractResult.threatStage,
    confidenceLevel: riskResult.confidenceLevel,
    contextQuality,
    riskTier: riskResult.riskTier,
  });

  // 8. Return
  return {
    riskTier: riskResult.riskTier,
    riskScore: riskResult.riskScore,
    summary,
    submissionRoute,
    narrativeFamily: extractResult.narrativeFamily,
    impersonationEntity: extractResult.impersonationEntity,
    requestedAction: extractResult.requestedAction,
    threatStage: extractResult.threatStage,
    confidenceLevel: riskResult.confidenceLevel,
    sourceType,
    contextQuality,
  };
}
