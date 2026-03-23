/**
 * Shared scan analysis module.
 * Single entry point: analyzeScan(input) -> ScanAnalysisResult
 *
 * NOT wired into production yet.
 */

import type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
import { routeSubmission } from "./router";
import { extract } from "./extract";
import { computeRisk } from "./risk";
import { explain } from "./explain";

export type { ScanAnalysisInput, ScanAnalysisResult } from "./types";
export * from "./taxonomy";

export function analyzeScan(input: ScanAnalysisInput): ScanAnalysisResult {
  const { messageText, source } = input;

  const trimmed = messageText.trim();
  const urlOnly = /^(https?:\/\/\S+|www\.\S+)$/i.test(trimmed);
  const veryShort = trimmed.length >= 20 && trimmed.length < 100;

  const submissionRoute = routeSubmission({
    messageText: trimmed,
    urlOnly,
    veryShort,
  });

  const extractResult = extract({
    messageText: trimmed.toLowerCase(),
    contextQuality: urlOnly ? "fragment" : "partial",
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
    confidenceLevel: "unknown",
    sourceType: source,
    contextQuality: urlOnly ? "fragment" : "partial",
  };
}
