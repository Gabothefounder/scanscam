import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createIntegrityClient,
  type IntegrityClientIdentity,
} from "@/lib/integrity/auth";
import {
  parseAcsToolCallRequest,
} from "@/lib/integrity/adapters/acs";
import {
  normalizeObservedToolCall,
} from "@/lib/integrity/action-envelope";
import { hashIntegrityValue } from "@/lib/integrity/canonical";
import {
  processAcsToolCallRequest,
  processAcsToolCallResult,
} from "@/lib/integrity/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type TestResult = {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
};

function record(
  results: TestResult[],
  id: string,
  passed: boolean,
  expected: string,
  actual: unknown
) {
  results.push({
    id,
    passed,
    expected,
    actual: typeof actual === "string" ? actual : JSON.stringify(actual),
  });
}

async function makeClient(input: {
  principal: string;
  name: string;
  kind: "actor" | "observer";
  scopes: Array<"preflight:write" | "commit:write" | "observe:write">;
}): Promise<IntegrityClientIdentity> {
  const created = await createIntegrityClient({
    principal_id: input.principal,
    name: input.name,
    kind: input.kind,
    scopes: input.scopes,
    metadata: { redteam: true, runtime: "acs-v0.7" },
  });

  return {
    client_id: created.client_id,
    principal_id: input.principal,
    name: input.name,
    kind: input.kind,
    scopes: input.scopes,
    credential_id: "redteam-direct",
  };
}

const safeSemantic = async () => ({
  goal_alignment: "aligned" as const,
  normalized_effect: "financial_transfer" as const,
  confidence: 0.99,
  deception_signals: [],
  effects: ["financial" as const],
  requires_human_review: false,
  material_claims: [],
  reasons: [],
  model: "acs-v07-redteam-stub",
});

function acsToolCallRequest(input: {
  requestId: string;
  agentId: string;
  sessionId: string;
  amount?: number;
  supplierCountry?: string;
  bankAccount?: string;
  vendorPolicy?: string;
  jsonrpcId?: number;
}) {
  const args: Record<string, unknown> = {
    vendor: { value: "ACME" },
    amount: { value: input.amount ?? 300 },
    currency: { value: "CAD" },
    bank_account: { value: input.bankAccount ?? "RBC-1111" },
    supplier_country: { value: input.supplierCountry ?? "CA" },
    flight: { value: { departure_time: "09:00", red_eye: false } },
  };
  if (input.vendorPolicy) args.vendor_policy = { value: input.vendorPolicy };

  return {
    jsonrpc: "2.0",
    id: input.jsonrpcId ?? 1,
    method: "steps/toolCallRequest",
    params: {
      acs_version: "0.1.0",
      request_id: input.requestId,
      timestamp: new Date().toISOString(),
      metadata: {
        agent_id: input.agentId,
        session_id: input.sessionId,
        turn_id: "turn-1",
      },
      payload: {
        tool: {
          name: input.toolName ?? "pay_invoice",
          provider: "erp.local",
          version: "pay-v1",
        },
        operation: "execute",
        capability: "financial_transfer",
        arguments: args,
        intent: {
          goal: "Pay the routine ACME invoice.",
          description: "Routine invoice to the established supplier and approved account.",
        },
      },
    },
  };
}

function acsToolCallResult(input: {
  requestId: string;
  requestIdRef: string;
  agentId: string;
  sessionId: string;
  exitStatus?: "success" | "failure" | "timeout" | "blocked";
  jsonrpcId?: number;
  toolName?: string;
}) {
  return {
    jsonrpc: "2.0",
    id: input.jsonrpcId ?? 2,
    method: "steps/toolCallResult",
    params: {
      acs_version: "0.1.0",
      request_id: input.requestId,
      timestamp: new Date().toISOString(),
      metadata: {
        agent_id: input.agentId,
        session_id: input.sessionId,
        turn_id: "turn-1",
      },
      payload: {
        request_id_ref: input.requestIdRef,
        tool: {
          name: "pay_invoice",
          provider: "erp.local",
          version: "pay-v1",
        },
        exit_status: input.exitStatus ?? "success",
        duration_ms: 37,
        outputs: [
          { value: { ok: true, transaction_ref: "tx-redteam" } },
        ],
      },
    },
  };
}

function responseDecision(response: Record<string, unknown>): string | null {
  const result = response.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const decision = (result as Record<string, unknown>).decision;
  return typeof decision === "string" ? decision : null;
}

function scanscamPolicyData(response: Record<string, unknown>): Record<string, unknown> {
  const result = response.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return {};
  const policyData = (result as Record<string, unknown>).policy_data;
  if (!policyData || typeof policyData !== "object" || Array.isArray(policyData)) return {};
  const scanscam = (policyData as Record<string, unknown>).scanscam;
  return scanscam && typeof scanscam === "object" && !Array.isArray(scanscam)
    ? scanscam as Record<string, unknown>
    : {};
}

async function cleanupPrincipals(principals: string[]) {
  const { data: authorizations } = await supabase
    .from("integrity_authorizations")
    .select("id")
    .in("principal_id", principals);
  const authorizationIds = (authorizations ?? []).map((row) => row.id);

  await supabase.from("integrity_runtime_executions").delete().in("principal_id", principals);

  if (authorizationIds.length) {
    await supabase.from("integrity_execution_receipts").delete().in("authorization_id", authorizationIds);
    await supabase.from("integrity_budget_reservations").delete().in("authorization_id", authorizationIds);
    await supabase.from("integrity_authorizations").delete().in("id", authorizationIds);
  }

  await supabase.from("integrity_challenges").delete().in("principal_id", principals);
  await supabase.from("integrity_attestations").delete().in("principal_id", principals);
  await supabase.from("integrity_action_observations").delete().in("principal_id", principals);
  await supabase.from("integrity_baselines").delete().in("principal_id", principals);
  await supabase.from("integrity_mandates").delete().in("principal_id", principals);
  await supabase.from("integrity_runtime_bindings").delete().in("principal_id", principals);

  const { data: clients } = await supabase
    .from("integrity_clients")
    .select("id")
    .in("principal_id", principals);
  const clientIds = (clients ?? []).map((row) => row.id);
  if (clientIds.length) {
    await supabase.from("integrity_client_credentials").delete().in("client_id", clientIds);
    await supabase.from("integrity_clients").delete().in("id", clientIds);
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = crypto.randomUUID();
  const principal = `acs-v07-${suffix}`;
  const otherPrincipal = `acs-v07-other-${suffix}`;
  const agentId = `agent-${suffix}`;
  const results: TestResult[] = [];

  try {
    const actor = await makeClient({
      principal,
      name: "acs-bound-actor",
      kind: "actor",
      scopes: ["preflight:write", "commit:write"],
    });
    const observer = await makeClient({
      principal,
      name: "acs-runtime-observer",
      kind: "observer",
      scopes: ["observe:write"],
    });
    const secondObserver = await makeClient({
      principal,
      name: "unbound-observer",
      kind: "observer",
      scopes: ["observe:write"],
    });
    const otherObserver = await makeClient({
      principal: otherPrincipal,
      name: "other-principal-observer",
      kind: "observer",
      scopes: ["observe:write"],
    });

    const mandate = {
      currency: "CAD",
      max_autonomous_amount: 5000,
      human_approval_amount: 2500,
      rules: [
        {
          id: "us-supplier-needs-approval",
          field: "context.action_envelope.policy_facts.supplier_country",
          operator: "eq",
          value: "US",
          effect: "require_approval",
          reason: "Ask before using a US supplier.",
        },
        {
          id: "hard-vendor-exclusion",
          field: "context.action_envelope.policy_facts.vendor_policy",
          operator: "eq",
          value: "never",
          effect: "block",
          reason: "Principal explicitly excluded this vendor class.",
        },
      ],
      objectives: [
        {
          id: "prefer-canada",
          field: "context.action_envelope.policy_facts.supplier_country",
          operator: "eq",
          value: "CA",
          mode: "prefer",
          weight: 60,
          private: true,
          reason: "Prefer Canadian suppliers.",
        },
      ],
      budgets: [],
    };

    await supabase.from("integrity_mandates").insert({
      principal_id: principal,
      version: 1,
      mandate,
      mandate_hash: hashIntegrityValue(mandate),
      active: true,
    });

    await supabase.from("integrity_runtime_bindings").insert({
      principal_id: principal,
      protocol: "acs",
      external_agent_id: agentId,
      observer_client_id: observer.client_id,
      actor_client_id: actor.client_id,
      status: "active",
      metadata: { redteam: true, acs_version: "0.1.0" },
    });

    const seedRequest = acsToolCallRequest({
      requestId: crypto.randomUUID(),
      agentId,
      sessionId: `seed-${suffix}`,
      amount: 300,
    });
    const parsedSeed = parseAcsToolCallRequest(seedRequest);
    const normalizedSeed = normalizeObservedToolCall(parsedSeed.observed);
    if (!normalizedSeed.envelope.subject_id) throw new Error("acs_v07_subject_missing");

    await supabase.from("integrity_baselines").insert({
      principal_id: principal,
      subject_id: normalizedSeed.envelope.subject_id,
      version: 1,
      state: normalizedSeed.state_snapshot,
      state_hash: hashIntegrityValue(normalizedSeed.state_snapshot),
    });

    record(
      results,
      "exact-acs-v01-argument-wrappers",
      parsedSeed.observed.arguments?.amount === 300 &&
        parsedSeed.observed.arguments?.supplier_country === "CA" &&
        parsedSeed.observed.hook === "steps/toolCallRequest",
      "published ACS v0.1 argument wrappers parse into the protocol-neutral observed call",
      parsedSeed.observed
    );

    let unboundError = "NO_ERROR";
    try {
      await processAcsToolCallRequest({
        body: acsToolCallRequest({
          requestId: crypto.randomUUID(),
          agentId,
          sessionId: `unbound-observer-${suffix}`,
        }),
        observer: secondObserver,
        semantic: safeSemantic,
      });
    } catch (error) {
      unboundError = error instanceof Error ? error.message : "unknown_error";
    }
    record(
      results,
      "observer-must-match-server-binding",
      unboundError === "runtime_binding_not_found",
      "runtime_binding_not_found",
      unboundError
    );

    let foreignError = "NO_ERROR";
    try {
      await processAcsToolCallRequest({
        body: acsToolCallRequest({
          requestId: crypto.randomUUID(),
          agentId,
          sessionId: `foreign-${suffix}`,
        }),
        observer: otherObserver,
        semantic: safeSemantic,
      });
    } catch (error) {
      foreignError = error instanceof Error ? error.message : "unknown_error";
    }
    record(
      results,
      "cross-principal-agent-id-cannot-select-policy",
      foreignError === "runtime_binding_not_found",
      "runtime_binding_not_found",
      foreignError
    );

    const safeRequestId = crypto.randomUUID();
    const safeRequest = acsToolCallRequest({
      requestId: safeRequestId,
      agentId,
      sessionId: `safe-${suffix}`,
      amount: 300,
      jsonrpcId: 10,
    });

    const safeResponse = await processAcsToolCallRequest({
      body: safeRequest,
      observer,
      semantic: safeSemantic,
    });

    const safePolicy = scanscamPolicyData(safeResponse);
    const serializedSafeResponse = JSON.stringify(safeResponse);

    const { data: safeExecution } = await supabase
      .from("integrity_runtime_executions")
      .select("id,status,authorization_id,observation_id,semantic_ran")
      .eq("principal_id", principal)
      .eq("external_request_id", safeRequestId)
      .single();

    record(
      results,
      "safe-request-allow-is-server-bound",
      responseDecision(safeResponse) === "allow" &&
        safePolicy.disposition === "ALLOW" &&
        safeExecution?.status === "authorized" &&
        typeof safeExecution?.authorization_id === "string" &&
        !serializedSafeResponse.includes("ssi_v1_") &&
        !serializedSafeResponse.includes("authorization_token"),
      "ALLOW creates a server-side execution binding without exposing a reusable authorization token",
      {
        decision: responseDecision(safeResponse),
        policy: safePolicy,
        execution: safeExecution,
      }
    );

    const wrongSessionResponse = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: safeRequestId,
        agentId,
        sessionId: `wrong-session-${suffix}`,
        exitStatus: "success",
        jsonrpcId: 101,
      }),
      observer,
    });
    const { data: afterWrongSession } = await supabase
      .from("integrity_runtime_executions")
      .select("status")
      .eq("id", safeExecution!.id)
      .single();

    record(
      results,
      "result-session-mismatch-does-not-consume",
      responseDecision(wrongSessionResponse) === "deny" &&
        JSON.stringify(wrongSessionResponse).includes("scanscam_runtime_result_context_mismatch") &&
        afterWrongSession?.status === "authorized",
      "wrong ACS session cannot settle an authorization and leaves the valid authorization intact",
      { response: wrongSessionResponse, execution: afterWrongSession }
    );

    const wrongToolResponse = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: safeRequestId,
        agentId,
        sessionId: `safe-${suffix}`,
        exitStatus: "success",
        jsonrpcId: 102,
        toolName: "delete_everything",
      }),
      observer,
    });
    const { data: afterWrongTool } = await supabase
      .from("integrity_runtime_executions")
      .select("status")
      .eq("id", safeExecution!.id)
      .single();

    record(
      results,
      "result-tool-mismatch-does-not-consume",
      responseDecision(wrongToolResponse) === "deny" &&
        JSON.stringify(wrongToolResponse).includes("scanscam_runtime_result_context_mismatch") &&
        afterWrongTool?.status === "authorized",
      "wrong ACS tool cannot settle an authorization and leaves the valid authorization intact",
      { response: wrongToolResponse, execution: afterWrongTool }
    );

    const safeResultResponse = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: safeRequestId,
        agentId,
        sessionId: `safe-${suffix}`,
        exitStatus: "success",
        jsonrpcId: 11,
      }),
      observer,
    });

    const { data: settledExecution } = await supabase
      .from("integrity_runtime_executions")
      .select("id,status,authorization_id")
      .eq("id", safeExecution!.id)
      .single();
    const { data: settledReceipt } = await supabase
      .from("integrity_execution_receipts")
      .select("id,outcome,external_execution_id")
      .eq("authorization_id", safeExecution!.authorization_id)
      .single();

    record(
      results,
      "tool-result-auto-commits-authorization",
      responseDecision(safeResultResponse) === "allow" &&
        settledExecution?.status === "succeeded" &&
        settledReceipt?.outcome === "succeeded" &&
        settledReceipt?.external_execution_id === `acs:${safeRequestId}`,
      "steps/toolCallResult automatically settles the server-held authorization and creates an execution receipt",
      {
        response: safeResultResponse,
        execution: settledExecution,
        receipt: settledReceipt,
      }
    );

    const replayResponse = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: safeRequestId,
        agentId,
        sessionId: `safe-${suffix}`,
        exitStatus: "success",
        jsonrpcId: 12,
      }),
      observer,
    });
    const { count: receiptCount } = await supabase
      .from("integrity_execution_receipts")
      .select("id", { count: "exact", head: true })
      .eq("authorization_id", safeExecution!.authorization_id);

    record(
      results,
      "tool-result-replay-is-idempotent",
      responseDecision(replayResponse) === "allow" &&
        JSON.stringify(replayResponse).includes("scanscam_runtime_result_replayed") &&
        receiptCount === 1,
      "replayed ACS result does not create a second execution receipt",
      { response: replayResponse, receipt_count: receiptCount }
    );

    const untrackedResponse = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: crypto.randomUUID(),
        agentId,
        sessionId: `untracked-${suffix}`,
        exitStatus: "success",
        jsonrpcId: 13,
      }),
      observer,
    });

    record(
      results,
      "untracked-tool-result-fails-closed",
      responseDecision(untrackedResponse) === "deny" &&
        JSON.stringify(untrackedResponse).includes("scanscam_untracked_tool_execution"),
      "toolCallResult without matching pre-execution authorization is denied by the Guardian",
      untrackedResponse
    );

    const approvalRequestId = crypto.randomUUID();
    const approvalResponse = await processAcsToolCallRequest({
      body: acsToolCallRequest({
        requestId: approvalRequestId,
        agentId,
        sessionId: `approval-${suffix}`,
        amount: 100,
        supplierCountry: "US",
        jsonrpcId: 20,
      }),
      observer,
      semantic: safeSemantic,
    });

    const { count: approvalExecutionCount } = await supabase
      .from("integrity_runtime_executions")
      .select("id", { count: "exact", head: true })
      .eq("principal_id", principal)
      .eq("external_request_id", approvalRequestId);

    record(
      results,
      "principal-approval-maps-to-acs-ask",
      responseDecision(approvalResponse) === "ask" &&
        JSON.stringify(approvalResponse).includes("ask_details") &&
        approvalExecutionCount === 0,
      "APPROVAL_REQUIRED maps to ACS ask and does not mint an execution authorization",
      approvalResponse
    );

    const denyRequestId = crypto.randomUUID();
    const denyResponse = await processAcsToolCallRequest({
      body: acsToolCallRequest({
        requestId: denyRequestId,
        agentId,
        sessionId: `deny-${suffix}`,
        amount: 50,
        vendorPolicy: "never",
        jsonrpcId: 30,
      }),
      observer,
      semantic: safeSemantic,
    });

    const { count: denyExecutionCount } = await supabase
      .from("integrity_runtime_executions")
      .select("id", { count: "exact", head: true })
      .eq("principal_id", principal)
      .eq("external_request_id", denyRequestId);

    record(
      results,
      "hard-policy-deny-maps-to-acs-deny",
      responseDecision(denyResponse) === "deny" && denyExecutionCount === 0,
      "DENY maps to ACS deny and does not mint an execution authorization",
      denyResponse
    );

    const challengeRequestId = crypto.randomUUID();
    const challengeResponse = await processAcsToolCallRequest({
      body: acsToolCallRequest({
        requestId: challengeRequestId,
        agentId,
        sessionId: `challenge-${suffix}`,
        amount: 100,
        bankAccount: "TD-ATTACKER",
        jsonrpcId: 40,
      }),
      observer,
      semantic: safeSemantic,
    });

    const { count: challengeExecutionCount } = await supabase
      .from("integrity_runtime_executions")
      .select("id", { count: "exact", head: true })
      .eq("principal_id", principal)
      .eq("external_request_id", challengeRequestId);

    record(
      results,
      "guardian-challenge-maps-to-acs-defer",
      responseDecision(challengeResponse) === "defer" &&
        JSON.stringify(challengeResponse).includes("defer_details") &&
        challengeExecutionCount === 0,
      "CHALLENGE maps to ACS defer and does not authorize execution",
      challengeResponse
    );

    const failedRequestId = crypto.randomUUID();
    const failedPreflight = await processAcsToolCallRequest({
      body: acsToolCallRequest({
        requestId: failedRequestId,
        agentId,
        sessionId: `failed-${suffix}`,
        amount: 200,
        jsonrpcId: 50,
      }),
      observer,
      semantic: safeSemantic,
    });
    const failedResult = await processAcsToolCallResult({
      body: acsToolCallResult({
        requestId: crypto.randomUUID(),
        requestIdRef: failedRequestId,
        agentId,
        sessionId: `failed-${suffix}`,
        exitStatus: "failure",
        jsonrpcId: 51,
      }),
      observer,
    });
    const { data: failedExecution } = await supabase
      .from("integrity_runtime_executions")
      .select("status,authorization_id")
      .eq("principal_id", principal)
      .eq("external_request_id", failedRequestId)
      .single();
    const { data: failedReceipt } = await supabase
      .from("integrity_execution_receipts")
      .select("outcome")
      .eq("authorization_id", failedExecution!.authorization_id)
      .single();

    record(
      results,
      "failed-tool-result-settles-as-failed",
      responseDecision(failedPreflight) === "allow" &&
        responseDecision(failedResult) === "allow" &&
        failedExecution?.status === "failed" &&
        failedReceipt?.outcome === "failed",
      "runtime failure settles the authorization as failed rather than leaving it reusable",
      { preflight: failedPreflight, result: failedResult, execution: failedExecution, receipt: failedReceipt }
    );

    const { data: binding } = await supabase
      .from("integrity_runtime_bindings")
      .select("id")
      .eq("principal_id", principal)
      .eq("external_agent_id", agentId)
      .single();
    await supabase
      .from("integrity_runtime_bindings")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", binding!.id);

    let revokedBindingError = "NO_ERROR";
    try {
      await processAcsToolCallRequest({
        body: acsToolCallRequest({
          requestId: crypto.randomUUID(),
          agentId,
          sessionId: `revoked-binding-${suffix}`,
          amount: 50,
          jsonrpcId: 60,
        }),
        observer,
        semantic: safeSemantic,
      });
    } catch (error) {
      revokedBindingError = error instanceof Error ? error.message : "unknown_error";
    }

    record(
      results,
      "revoked-runtime-binding-fails-closed",
      revokedBindingError === "runtime_binding_not_found",
      "runtime_binding_not_found",
      revokedBindingError
    );
  } catch (error) {
    record(
      results,
      "suite-runtime",
      false,
      "no runtime error",
      error instanceof Error ? error.message : "unknown_error"
    );
  } finally {
    await cleanupPrincipals([principal, otherPrincipal]);
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "integrity-acs-runtime-v0.7",
    total: results.length,
    passed,
    failed: results.length - passed,
    pass_rate: results.length ? Number((passed / results.length).toFixed(3)) : 0,
    tests: results,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "X-ScanScam-Integrity-Version": "0.7",
      "X-ScanScam-ACS-Version": "0.1.0",
    },
  });
}
