import type {
  IntegrityV1Challenge,
  IntegrityV1CommitResponse,
  IntegrityV1ErrorBody,
  IntegrityV1PreflightResponse,
} from "../../packages/integrity-sdk/src/types";
import type { IntegrityChallenge } from "./challenge";
import type { ExecutionCommitResult } from "./receipts";
import type { IntegrityV05Result } from "./v05";

export function toIntegrityV1Challenge(
  challenge: IntegrityChallenge | null
): IntegrityV1Challenge | null {
  if (!challenge) return null;
  return {
    id: challenge.id,
    status: challenge.status,
    expires_at: challenge.expires_at,
    retry_count: challenge.retry_count,
    requirements: challenge.requirements.map((item) => ({ ...item })),
  };
}

export function toIntegrityV1Preflight(
  result: IntegrityV05Result,
  challenge: IntegrityChallenge | null
): IntegrityV1PreflightResponse {
  return {
    api_version: "1",
    disposition: result.disposition,
    intervention_score: result.intervention_score,
    signals: result.signals.map((signal) => ({
      code: signal.code,
      severity: signal.severity,
      message: signal.message,
      ...(signal.path ? { path: signal.path } : {}),
    })),
    required_controls: [...result.required_controls],
    challenge_requirements: result.challenge_requirements.map((item) => ({
      ...item,
    })),
    value_guard: {
      preference_score: result.value_guard.preference_score,
      matched_count: result.value_guard.matched_count,
      private_match_count: result.value_guard.private_match_count,
    },
    authorization: result.authorization
      ? {
          id: result.authorization.id,
          token: result.authorization.token,
          expires_at: result.authorization.expires_at,
          action_hash: result.authorization.action_hash,
        }
      : null,
    challenge: toIntegrityV1Challenge(challenge),
    trust: {
      observation_id: result.trust.observation_id,
      mandate_version: result.trust.mandate.version,
      baseline_version: result.trust.baseline?.version ?? null,
      attestation_ids: [...result.trust.attestation_ids],
      semantic_ran: result.trust.semantic.ran,
    },
  };
}

export function toIntegrityV1Commit(
  result: ExecutionCommitResult
): IntegrityV1CommitResponse {
  return {
    api_version: "1",
    ...result,
  };
}

export function integrityV1Error(
  code: string,
  message?: string
): IntegrityV1ErrorBody {
  return {
    error: {
      code,
      ...(message ? { message } : {}),
    },
  };
}
