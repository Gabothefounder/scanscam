/**
 * Shared scan analysis module.
 * Single entry point: analyzeScan(input) -> ScanAnalysisResult
 *
 * No DB writes, route logic, or UI logic. Uses router, extract, risk, explain.
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
