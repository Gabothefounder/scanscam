export type IntegrityJson =
  | string
  | number
  | boolean
  | null
  | IntegrityJson[]
  | { [key: string]: IntegrityJson };

export type IntegrityV1Disposition =
  | "ALLOW"
  | "CHALLENGE"
  | "APPROVAL_REQUIRED"
  | "DENY";

export type IntegrityV1Severity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type IntegrityV1Signal = {
  code: string;
  severity: IntegrityV1Severity;
  message: string;
  path?: string;
};

export type IntegrityV1ChallengeRequirement = {
  id: string;
  kind:
    | "attestation"
    | "principal_approval"
    | "establish_baseline"
    | "semantic_retry"
    | "runtime_context";
  claim?: string;
  reason: string;
};

export type IntegrityV1Authorization = {
  id: string;
  token: string;
  expires_at: string;
  action_hash: string;
};

export type IntegrityV1Challenge = {
  id: string;
  status: "open" | "satisfied" | "closed" | "expired" | "cancelled";
  expires_at: string;
  retry_count: number;
  requirements: IntegrityV1ChallengeRequirement[];
};

export type IntegrityV1Trust = {
  observation_id: string;
  mandate_version: number;
  baseline_version: number | null;
  attestation_ids: string[];
  semantic_ran: boolean;
};

export type IntegrityV1PreflightRequest = {
  observation_id: string;
  attestation_ids?: string[];
};

export type IntegrityV1PreflightResponse = {
  api_version: "1";
  disposition: IntegrityV1Disposition;
  intervention_score: number;
  signals: IntegrityV1Signal[];
  required_controls: string[];
  challenge_requirements: IntegrityV1ChallengeRequirement[];
  value_guard: {
    preference_score: number;
    matched_count: number;
    private_match_count: number;
  };
  authorization: IntegrityV1Authorization | null;
  challenge: IntegrityV1Challenge | null;
  trust: IntegrityV1Trust;
};

export type IntegrityV1ObservedToolCall = {
  protocol: "acs" | "mcp" | "a2a" | "http" | "native" | "other";
  hook?: string;
  session_id?: string;
  step_id?: string;
  goal?: string;
  causal_context?: string;
  tool: {
    name: string;
    server?: string;
    description?: string;
    schema_hash?: string;
  };
  arguments?: Record<string, IntegrityJson>;
};

export type IntegrityV1ObserveResponse = {
  api_version: "1";
  observation_id: string;
  envelope_hash: string;
  expires_at: string;
};

export type IntegrityV1AttestationRequest = {
  claim_text: string;
  evidence?: Record<string, IntegrityJson>;
  observed_at?: string;
  expires_at?: string | null;
};

export type IntegrityV1Attestation = {
  id: string;
  claim_text: string;
  issuer: string;
  trust_level: "principal_verifier";
  observed_at: string;
  expires_at: string | null;
};

export type IntegrityV1AttestationResponse = {
  api_version: "1";
  attestation: IntegrityV1Attestation;
};

export type IntegrityV1ChallengeRetryRequest = {
  challenge_id: string;
  attestation_ids?: string[];
};

export type IntegrityV1CommitRequest = {
  authorization_id: string;
  authorization_token: string;
  executed_action: {
    type: string;
    amount?: number;
    currency?: string;
    counterparty_id?: string;
    irreversible?: boolean;
    creates_commitment?: boolean;
    destination?: string;
    metadata?: Record<string, IntegrityJson>;
  };
  outcome: "succeeded" | "failed";
  resulting_state?: Record<string, IntegrityJson>;
  external_execution_id?: string;
  executed_at?: string;
  metadata?: Record<string, IntegrityJson>;
};

export type IntegrityV1CommitResponse = {
  api_version: "1";
  ok: boolean;
  replayed?: boolean;
  error?: string;
  authorization_id?: string;
  execution_receipt_id?: string;
  outcome?: "succeeded" | "failed";
  subject_id?: string | null;
  baseline_version_after?: number | null;
};

export type IntegrityV1ErrorBody = {
  error: {
    code: string;
    message?: string;
  };
};
