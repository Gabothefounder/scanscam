/**
 * Types for shared scan analysis.
 */

import type {
  RiskTier,
  SubmissionRoute,
  NarrativeFamily,
  ImpersonationEntity,
  RequestedAction,
  ThreatStage,
  ConfidenceLevel,
  SourceType,
  ContextQuality,
} from "./taxonomy";

export type ScanAnalysisInput = {
  messageText: string;
  language: "en" | "fr" | "mixed";
  source: SourceType;
};

export type ScanAnalysisResult = {
  riskTier: RiskTier;
  riskScore: number;
  summary: string | null;
  submissionRoute: SubmissionRoute;
  narrativeFamily: NarrativeFamily;
  impersonationEntity: ImpersonationEntity;
  requestedAction: RequestedAction;
  threatStage: ThreatStage;
  confidenceLevel: ConfidenceLevel;
  sourceType: SourceType;
  contextQuality?: ContextQuality;
};
