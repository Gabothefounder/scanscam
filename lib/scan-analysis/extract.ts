/**
 * Feature extraction: narrative, impersonation, action, threat.
 */

import type { NarrativeFamily, ImpersonationEntity, RequestedAction, ThreatStage } from "./taxonomy";

export type ExtractInput = {
  messageText: string;
  contextQuality: string;
};

export type ExtractResult = {
  narrativeFamily: NarrativeFamily;
  impersonationEntity: ImpersonationEntity;
  requestedAction: RequestedAction;
  threatStage: ThreatStage;
};

export function extract(input: ExtractInput): ExtractResult {
  return {
    narrativeFamily: "unknown",
    impersonationEntity: "unknown",
    requestedAction: "unknown",
    threatStage: "none",
  };
}
