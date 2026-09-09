import {
  IntegrityApiError,
  createIntegrityClient,
} from "../packages/integrity-sdk/src/index";
import { toIntegrityV1Preflight } from "../lib/integrity/public-v1";
import type { IntegrityV05Result } from "../lib/integrity/v05";

async function main() {
type Call = {
  url: string;
  init?: RequestInit;
};

const calls: Call[] = [];

const fakeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  calls.push({ url, init });

  if (url.endsWith("/observe")) {
    return new Response(JSON.stringify({
      api_version: "1",
      observation_id: "11111111-1111-4111-8111-111111111111",
      envelope_hash: "env-hash",
      expires_at: "2026-09-07T15:00:00.000Z",
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }

  if (url.endsWith("/preflight")) {
    return new Response(JSON.stringify({
      api_version: "1",
      disposition: "ALLOW",
      intervention_score: 0.1,
      signals: [],
      required_controls: [],
      challenge_requirements: [],
      value_guard: {
        preference_score: 0,
        matched_count: 0,
        private_match_count: 0,
      },
      authorization: null,
      challenge: null,
      trust: {
        observation_id: "11111111-1111-4111-8111-111111111111",
        mandate_version: 1,
        baseline_version: null,
        attestation_ids: [],
        semantic_ran: false,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    error: {
      code: "synthetic_failure",
      message: "Synthetic API failure.",
    },
  }), {
    status: 409,
    headers: { "content-type": "application/json" },
  });
};

const client = createIntegrityClient({
  baseUrl: "https://integrity.example/",
  apiKey: "ssi_v1_test_credential_that_is_long_enough",
  fetch: fakeFetch,
});

const observation = await client.observe({
  protocol: "mcp",
  step_id: "step-1",
  tool: { name: "pay_invoice" },
  arguments: {
    vendor: "ACME",
    amount: 300,
    currency: "CAD",
  },
});

if (observation.api_version !== "1") throw new Error("sdk_observe_version_failed");
if (calls[0]?.url !== "https://integrity.example/api/integrity/v1/observe") {
  throw new Error("sdk_observe_path_failed");
}
const headers = new Headers(calls[0]?.init?.headers);
if (headers.get("authorization") !== "Bearer ssi_v1_test_credential_that_is_long_enough") {
  throw new Error("sdk_auth_header_failed");
}

const decision = await client.preflight({
  observation_id: observation.observation_id,
});

if (decision.disposition !== "ALLOW") throw new Error("sdk_preflight_result_failed");
if (calls[1]?.url !== "https://integrity.example/api/integrity/v1/preflight") {
  throw new Error("sdk_preflight_path_failed");
}

let errorPassed = false;
try {
  await client.commit({
    authorization_id: "auth-1",
    authorization_token: "token-that-is-long-enough",
    executed_action: { type: "transfer_funds" },
    outcome: "succeeded",
  });
} catch (error) {
  if (
    error instanceof IntegrityApiError &&
    error.status === 409 &&
    error.code === "synthetic_failure"
  ) {
    errorPassed = true;
  }
}
if (!errorPassed) throw new Error("sdk_error_mapping_failed");

const internal = {
  version: "0.5",
  disposition: "ALLOW",
  intervention_score: 0.2,
  action: {
    version: "0.5",
    effect: "financial_transfer",
    verb: "transfer_funds",
    tool: {
      protocol: "mcp",
      hook: "tool_call",
      name: "pay_invoice",
    },
    consequences: {
      irreversible: true,
      creates_commitment: true,
    },
    arguments_hash: "arguments-hash",
  },
  signals: [{
    code: "IRREVERSIBLE_ACTION",
    severity: "medium",
    message: "Preserve receipt.",
  }],
  required_controls: ["receipt"],
  challenge_requirements: [],
  value_guard: {
    preference_score: 0,
    matched_count: 0,
    private_match_count: 0,
  },
  trust: {
    observation_id: "22222222-2222-4222-8222-222222222222",
    observer_client_id: "observer-secret-internal-id",
    observation_protocol: "mcp",
    mandate: { version: 7, hash: "mandate-hash" },
    baseline: { version: 3, hash: "baseline-hash" },
    attestation_ids: [],
    semantic: {
      required: false,
      ran: false,
      confidence: 0.99,
    },
  },
  authorization: {
    id: "auth-2",
    token: "one-time-token",
    expires_at: "2026-09-07T15:05:00.000Z",
    action_hash: "action-hash",
    subject_id: "internal-subject",
    mandate: { version: 7, hash: "mandate-hash" },
    baseline: { version: 3, hash: "baseline-hash" },
  },
} as IntegrityV05Result;

const publicResult = toIntegrityV1Preflight(internal, null);
const serialized = JSON.stringify(publicResult);

if (publicResult.api_version !== "1") throw new Error("public_v1_version_failed");
if (publicResult.trust.mandate_version !== 7) throw new Error("public_v1_mandate_projection_failed");
if (publicResult.authorization?.id !== "auth-2") throw new Error("public_v1_authorization_failed");
if (serialized.includes("observer-secret-internal-id")) {
  throw new Error("public_v1_leaked_observer_identity");
}
if (serialized.includes('"action":')) {
  throw new Error("public_v1_leaked_action_envelope");
}
if (serialized.includes('"confidence":')) {
  throw new Error("public_v1_leaked_semantic_internals");
}
if (serialized.includes('"subject_id":"internal-subject"')) {
  throw new Error("public_v1_leaked_authorization_subject");
}

console.log(JSON.stringify({
  suite: "integrity-sdk-public-v1",
  passed: 10,
  failed: 0,
  checks: [
    "observe path",
    "bearer auth",
    "preflight path",
    "response typing",
    "error normalization",
    "v1 version",
    "mandate projection",
    "authorization projection",
    "internal identity redaction",
    "internal action/semantic redaction",
  ],
}, null, 2));

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
