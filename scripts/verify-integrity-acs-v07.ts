import assert from "node:assert/strict";
import {
  guardianResponseForACS,
  parseAcsToolCallRequest,
  parseAcsToolCallResult,
} from "../lib/integrity/adapters/acs";

type Case = { id: string; passed: boolean; detail?: string };
const cases: Case[] = [];

function check(id: string, fn: () => void) {
  try {
    fn();
    cases.push({ id, passed: true });
  } catch (error) {
    cases.push({
      id,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

const requestId = "11111111-1111-4111-8111-111111111111";
const resultRequestId = "22222222-2222-4222-8222-222222222222";

function validRequest() {
  return {
    jsonrpc: "2.0",
    id: 7,
    method: "steps/toolCallRequest",
    params: {
      acs_version: "0.1.0",
      request_id: requestId,
      timestamp: "2026-09-07T02:00:00.000Z",
      metadata: {
        agent_id: "agent-redteam",
        session_id: "session-redteam",
        turn_id: "turn-1",
      },
      payload: {
        tool: {
          name: "pay_invoice",
          provider: "erp.local",
          version: "pay-v1",
        },
        operation: "execute",
        capability: "financial_transfer",
        raw_command: "PAY SUPER SECRET RAW COMMAND",
        arguments: {
          vendor: { value: "ACME", provenance: { source: "runtime" } },
          amount: { value: 300 },
          currency: { value: "CAD" },
          nested: { value: { a: true, b: [1, 2, 3] } },
        },
        intent: {
          goal: "Pay routine invoice",
          description: "Routine established supplier payment",
        },
      },
    },
  };
}

function validResult() {
  return {
    jsonrpc: "2.0",
    id: "result-7",
    method: "steps/toolCallResult",
    params: {
      acs_version: "0.1.0",
      request_id: resultRequestId,
      timestamp: "2026-09-07T02:00:01.000Z",
      metadata: {
        agent_id: "agent-redteam",
        session_id: "session-redteam",
        turn_id: "turn-1",
      },
      payload: {
        request_id_ref: requestId,
        tool: {
          name: "pay_invoice",
          provider: "erp.local",
          version: "pay-v1",
        },
        exit_status: "success",
        duration_ms: 42,
        outputs: [
          { value: { ok: true, transaction_id: "tx-1" } },
        ],
      },
    },
  };
}

function resultFor(disposition: "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "CHALLENGE") {
  const authorization = disposition === "ALLOW"
    ? {
        id: "auth-visible-id",
        token: "THIS_SECRET_TOKEN_MUST_NEVER_APPEAR",
        expires_at: "2026-09-07T02:05:00.000Z",
        action_hash: "hash",
        subject_id: "counterparty:acme",
        mandate: { version: 1, hash: "mandate-hash" },
        baseline: { version: 1, hash: "baseline-hash" },
      }
    : null;

  return {
    version: "0.5",
    disposition,
    intervention_score: disposition === "ALLOW" ? 0.1 : 0.8,
    action: {
      version: "0.5",
      effect: "financial_transfer",
      verb: "pay_invoice",
      tool: { protocol: "acs", hook: "steps/toolCallRequest", name: "pay_invoice" },
      money: { amount: 300, currency: "CAD" },
      consequences: { irreversible: true, creates_commitment: true },
      arguments_hash: "args-hash",
    },
    signals:
      disposition === "ALLOW"
        ? []
        : [{ code: disposition === "DENY" ? "BLOCK_TEST" : "TEST_SIGNAL", severity: "high", message: "test" }],
    required_controls:
      disposition === "APPROVAL_REQUIRED"
        ? ["principal_approval"]
        : disposition === "CHALLENGE"
          ? ["independent_evidence"]
          : [],
    challenge_requirements:
      disposition === "CHALLENGE"
        ? [{ id: "proof-1", kind: "attestation", claim: "Verify bank change", reason: "test" }]
        : [],
    value_guard: {
      preference_score: 0.2,
      matched_count: 1,
      private_match_count: 1,
    },
    trust: {
      observation_id: "33333333-3333-4333-8333-333333333333",
      observer_client_id: "44444444-4444-4444-8444-444444444444",
      observation_protocol: "acs",
      mandate: { version: 1, hash: "mandate-hash" },
      baseline: { version: 1, hash: "baseline-hash" },
      attestation_ids: [],
      semantic: { required: false, ran: false },
    },
    authorization,
  } as any;
}

check("request-parses-exact-v01-envelope", () => {
  const parsed = parseAcsToolCallRequest(validRequest());
  assert.equal(parsed.request_id, requestId);
  assert.equal(parsed.jsonrpc_id, 7);
  assert.equal(parsed.agent_id, "agent-redteam");
  assert.equal(parsed.session_id, "session-redteam");
  assert.equal(parsed.observed.hook, "steps/toolCallRequest");
  assert.equal(parsed.observed.tool.name, "pay_invoice");
  assert.equal(parsed.observed.arguments?.amount, 300);
  assert.deepEqual(parsed.observed.arguments?.nested, { a: true, b: [1, 2, 3] });
});

check("raw-command-is-hashed-not-retained", () => {
  const parsed = parseAcsToolCallRequest(validRequest());
  const serialized = JSON.stringify(parsed.observed);
  assert.equal(serialized.includes("PAY SUPER SECRET RAW COMMAND"), false);
  const acs = parsed.observed.arguments?.__acs as Record<string, unknown>;
  assert.equal(typeof acs.raw_command_hash, "string");
});

check("unwrapped-argument-is-rejected", () => {
  const malformed = validRequest();
  (malformed.params.payload.arguments as any).amount = 300;
  assert.throws(
    () => parseAcsToolCallRequest(malformed),
    /acs_argument_wrapper_invalid/
  );
});

check("wrong-hook-method-is-rejected", () => {
  const malformed = validRequest();
  malformed.method = "steps/otherHook";
  assert.throws(
    () => parseAcsToolCallRequest(malformed),
    /acs_tool_call_request_required/
  );
});

check("bad-request-id-is-rejected", () => {
  const malformed = validRequest();
  malformed.params.request_id = "not-a-uuid";
  assert.throws(
    () => parseAcsToolCallRequest(malformed),
    /acs_request_id_invalid/
  );
});

check("tool-result-links-to-request", () => {
  const parsed = parseAcsToolCallResult(validResult());
  assert.equal(parsed.request_id_ref, requestId);
  assert.equal(parsed.request_id, resultRequestId);
  assert.equal(parsed.tool_name, "pay_invoice");
  assert.equal(parsed.exit_status, "success");
  assert.equal(parsed.duration_ms, 42);
  assert.equal(typeof parsed.output_hash, "string");
  assert.ok(parsed.output_hash.length >= 32);
});

check("invalid-exit-status-is-rejected", () => {
  const malformed = validResult();
  (malformed.params.payload as any).exit_status = "maybe";
  assert.throws(
    () => parseAcsToolCallResult(malformed),
    /acs_exit_status_invalid/
  );
});

const requestContext = parseAcsToolCallRequest(validRequest());

check("allow-maps-to-acs-allow-without-token-leak", () => {
  const response = guardianResponseForACS({
    request: requestContext,
    result: resultFor("ALLOW"),
    evaluation_duration_ms: 12,
  });
  const serialized = JSON.stringify(response);
  assert.equal((response as any).result.decision, "allow");
  assert.equal((response as any).result.id, undefined);
  assert.equal((response as any).id, 7);
  assert.equal(serialized.includes("THIS_SECRET_TOKEN_MUST_NEVER_APPEAR"), false);
  assert.equal(serialized.includes("authorization_token"), false);
  assert.equal((response as any).result.policy_data.scanscam.authorization_id, "auth-visible-id");
});

check("approval-maps-to-acs-ask", () => {
  const response = guardianResponseForACS({
    request: requestContext,
    result: resultFor("APPROVAL_REQUIRED"),
    evaluation_duration_ms: 8,
  });
  assert.equal((response as any).result.decision, "ask");
  assert.equal((response as any).result.ask_details.timeout_disposition, "deny");
  assert.deepEqual((response as any).result.ask_details.options, ["approve", "deny"]);
});

check("challenge-maps-to-acs-defer", () => {
  const response = guardianResponseForACS({
    request: requestContext,
    result: resultFor("CHALLENGE"),
    challenge_id: "challenge-1",
    evaluation_duration_ms: 9,
  });
  assert.equal((response as any).result.decision, "defer");
  assert.equal((response as any).result.defer_details.reason, "pending_dependency");
  assert.deepEqual((response as any).result.defer_details.required_context, ["Verify bank change"]);
});

check("deny-maps-to-acs-deny", () => {
  const response = guardianResponseForACS({
    request: requestContext,
    result: resultFor("DENY"),
    evaluation_duration_ms: 4,
  });
  assert.equal((response as any).result.decision, "deny");
  assert.equal("ask_details" in (response as any).result, false);
  assert.equal("defer_details" in (response as any).result, false);
});

const failed = cases.filter((item) => !item.passed);
console.log(JSON.stringify({
  suite: "integrity-acs-adapter-v0.7",
  total: cases.length,
  passed: cases.length - failed.length,
  failed: failed.length,
  pass_rate: cases.length ? Number(((cases.length - failed.length) / cases.length).toFixed(3)) : 0,
  cases,
}, null, 2));

if (failed.length) process.exit(1);
