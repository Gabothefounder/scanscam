import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { trustedPreflight, type TrustedPreflightRequest } from "@/lib/integrity/trusted";
import {
  commitExecution,
  hashIntegrityValue,
  issueAuthorizationReceipt,
  type AuthorizationReceipt,
} from "@/lib/integrity/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type Result = {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
};

async function authorize(
  request: TrustedPreflightRequest,
  options?: { ttlSeconds?: number }
): Promise<AuthorizationReceipt> {
  const preflight = await trustedPreflight(request);
  if (preflight.decision !== "ALLOW") {
    throw new Error(`redteam_preflight_not_allow:${preflight.decision}`);
  }
  return issueAuthorizationReceipt(request, preflight, options);
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = crypto.randomUUID();
  const subjectId = `commit-redteam-${suffix}`;
  const results: Result[] = [];
  const authorizationIds: string[] = [];

  let baselineState: Record<string, any> = {
    vendor: { bank_account: "RBC-RT", typical_amount: 100, status: "active" },
  };

  try {
    const { error: seedError } = await supabase.from("integrity_baselines").insert({
      principal_id: "demo-gabriel",
      subject_id: subjectId,
      version: 1,
      state: baselineState,
      state_hash: hashIntegrityValue(baselineState),
    });
    if (seedError) throw new Error("redteam_seed_failed");

    const baseRequest = (): TrustedPreflightRequest => ({
      principal_id: "demo-gabriel",
      subject_id: subjectId,
      proposed_action: {
        type: "send_payment",
        amount: 100,
        currency: "CAD",
        counterparty_id: subjectId,
      },
      current_state: baselineState,
      trace_excerpt: "Pay the routine 100 CAD supplier invoice to the established account.",
      semantic_mode: "off",
    });

    // 1. Exact authorized action succeeds and advances baseline.
    const auth1 = await authorize(baseRequest());
    authorizationIds.push(auth1.id);
    const state2 = {
      vendor: {
        ...baselineState.vendor,
        last_payment_amount: 100,
        last_payment_status: "settled",
      },
    };
    const commit1 = await commitExecution({
      authorization_id: auth1.id,
      authorization_token: auth1.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: state2,
      external_execution_id: `rt-valid-${suffix}`,
    });
    results.push({
      id: "exact-action-commit",
      passed: commit1.ok === true && commit1.baseline_version_after === 2,
      expected: "ok / baseline v2",
      actual: JSON.stringify(commit1),
    });
    baselineState = state2;

    // 2. Identical Commit retry is idempotent: same receipt, no second baseline transition.
    const replay = await commitExecution({
      authorization_id: auth1.id,
      authorization_token: auth1.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: baselineState,
      external_execution_id: `rt-replay-${suffix}`,
    });
    const { data: afterReplay } = await supabase
      .from("integrity_baselines")
      .select("version")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .single();
    results.push({
      id: "idempotent-commit-retry",
      passed:
        replay.ok === true &&
        replay.replayed === true &&
        replay.execution_receipt_id === commit1.execution_receipt_id &&
        Number(afterReplay?.version) === 2,
      expected: "same execution receipt / baseline remains v2",
      actual: JSON.stringify({ replay, baseline: afterReplay }),
    });

    // 3. Tampering with the executed action is rejected.
    const auth2 = await authorize(baseRequest());
    authorizationIds.push(auth2.id);
    const tampered = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: auth2.token,
      executed_action: { ...baseRequest().proposed_action, amount: 101 },
      outcome: "succeeded",
      resulting_state: baselineState,
    });
    results.push({
      id: "action-tamper-blocked",
      passed: tampered.ok === false && tampered.error === "executed_action_mismatch",
      expected: "executed_action_mismatch",
      actual: JSON.stringify(tampered),
    });

    // 4. A stolen ID without the one-time token is insufficient.
    const badToken = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: crypto.randomBytes(32).toString("base64url"),
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: baselineState,
    });
    results.push({
      id: "invalid-token-blocked",
      passed: badToken.ok === false && badToken.error === "authorization_token_invalid",
      expected: "authorization_token_invalid",
      actual: JSON.stringify(badToken),
    });

    // 5. Failed tamper/token attempts do not consume a valid receipt.
    const state3 = {
      vendor: { ...baselineState.vendor, retry_after_integrity_check: true },
    };
    const recovered = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: auth2.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: state3,
      external_execution_id: `rt-recovered-${suffix}`,
    });
    results.push({
      id: "valid-retry-after-rejected-attacks",
      passed: recovered.ok === true && recovered.baseline_version_after === 3,
      expected: "ok / baseline v3",
      actual: JSON.stringify(recovered),
    });
    baselineState = state3;

    // 6. Authorization becomes invalid if the authoritative baseline moves.
    const auth3 = await authorize(baseRequest());
    authorizationIds.push(auth3.id);
    const concurrentState = {
      vendor: { ...baselineState.vendor, concurrent_change: "another authorized execution" },
    };
    const { error: concurrentError } = await supabase
      .from("integrity_baselines")
      .update({
        version: 4,
        state: concurrentState,
        state_hash: hashIntegrityValue(concurrentState),
        updated_at: new Date().toISOString(),
      })
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .eq("version", 3);
    if (concurrentError) throw new Error("redteam_concurrent_update_failed");
    baselineState = concurrentState;

    const stale = await commitExecution({
      authorization_id: auth3.id,
      authorization_token: auth3.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: baselineState,
    });
    results.push({
      id: "stale-baseline-blocked",
      passed: stale.ok === false && stale.error === "authorization_stale_baseline",
      expected: "authorization_stale_baseline",
      actual: JSON.stringify(stale),
    });

    // 7. Expired authorization cannot execute.
    const expiredAuth = await authorize(baseRequest(), { ttlSeconds: -1 });
    authorizationIds.push(expiredAuth.id);
    const expired = await commitExecution({
      authorization_id: expiredAuth.id,
      authorization_token: expiredAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: baselineState,
    });
    results.push({
      id: "expired-authorization-blocked",
      passed: expired.ok === false && expired.error === "authorization_expired",
      expected: "authorization_expired",
      actual: JSON.stringify(expired),
    });

    // 8. A successful subject-bound execution must report resulting state.
    const missingStateAuth = await authorize(baseRequest());
    authorizationIds.push(missingStateAuth.id);
    const missingState = await commitExecution({
      authorization_id: missingStateAuth.id,
      authorization_token: missingStateAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
    });
    results.push({
      id: "missing-resulting-state-blocked",
      passed: missingState.ok === false && missingState.error === "resulting_state_required",
      expected: "resulting_state_required",
      actual: JSON.stringify(missingState),
    });

    // 9. Failed execution consumes the receipt but does not advance baseline.
    const failedAuth = await authorize(baseRequest());
    authorizationIds.push(failedAuth.id);
    const failedCommit = await commitExecution({
      authorization_id: failedAuth.id,
      authorization_token: failedAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "failed",
      external_execution_id: `rt-failed-${suffix}`,
    });
    const { data: afterFailure } = await supabase
      .from("integrity_baselines")
      .select("version,state_hash")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .single();

    results.push({
      id: "failed-execution-consumes-without-state-advance",
      passed:
        failedCommit.ok === true &&
        failedCommit.baseline_version_after === null &&
        Number(afterFailure?.version) === 4,
      expected: "consumed / baseline remains v4",
      actual: JSON.stringify({ failedCommit, baseline: afterFailure }),
    });

    // 10. A policy revision after authorization invalidates the old authorization.
    const stalePrincipal = `commit-redteam-principal-${suffix}`;
    const staleSubject = `commit-redteam-mandate-subject-${suffix}`;
    const staleMandate = {
      currency: "CAD",
      max_autonomous_amount: 5000,
      human_approval_amount: 2500,
    };
    await supabase.from("integrity_mandates").insert({
      principal_id: stalePrincipal,
      version: 1,
      mandate: staleMandate,
      mandate_hash: `${stalePrincipal}:v1`,
      active: true,
    });
    const staleMandateState = { vendor: { bank_account: "RBC-MANDATE", typical_amount: 100 } };
    await supabase.from("integrity_baselines").insert({
      principal_id: stalePrincipal,
      subject_id: staleSubject,
      version: 1,
      state: staleMandateState,
      state_hash: hashIntegrityValue(staleMandateState),
    });
    const staleMandateRequest: TrustedPreflightRequest = {
      principal_id: stalePrincipal,
      subject_id: staleSubject,
      proposed_action: {
        type: "send_payment",
        amount: 100,
        currency: "CAD",
        counterparty_id: staleSubject,
      },
      current_state: staleMandateState,
      trace_excerpt: "Pay the routine invoice to the established account.",
      semantic_mode: "off",
    };
    const mandateAuth = await authorize(staleMandateRequest);
    authorizationIds.push(mandateAuth.id);
    await supabase
      .from("integrity_mandates")
      .update({ active: false })
      .eq("principal_id", stalePrincipal)
      .eq("version", 1);
    await supabase.from("integrity_mandates").insert({
      principal_id: stalePrincipal,
      version: 2,
      mandate: staleMandate,
      mandate_hash: `${stalePrincipal}:v2`,
      active: true,
    });
    const staleMandateCommit = await commitExecution({
      authorization_id: mandateAuth.id,
      authorization_token: mandateAuth.token,
      executed_action: staleMandateRequest.proposed_action,
      outcome: "succeeded",
      resulting_state: staleMandateState,
    });
    results.push({
      id: "stale-mandate-blocked",
      passed:
        staleMandateCommit.ok === false &&
        staleMandateCommit.error === "authorization_stale_mandate",
      expected: "authorization_stale_mandate",
      actual: JSON.stringify(staleMandateCommit),
    });

    await supabase.from("integrity_baselines").delete()
      .eq("principal_id", stalePrincipal)
      .eq("subject_id", staleSubject);
    await supabase.from("integrity_mandates").delete()
      .eq("principal_id", stalePrincipal);
  } catch (error) {
    results.push({
      id: "suite-runtime",
      passed: false,
      expected: "no runtime error",
      actual: error instanceof Error ? error.message : "unknown_error",
    });
  } finally {
    if (authorizationIds.length) {
      await supabase
        .from("integrity_execution_receipts")
        .delete()
        .in("authorization_id", authorizationIds);
      await supabase
        .from("integrity_authorizations")
        .delete()
        .in("id", authorizationIds);
    }
    await supabase
      .from("integrity_baselines")
      .delete()
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId);
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "execution-receipt-v0.3",
    total: results.length,
    passed,
    failed: results.length - passed,
    pass_rate: results.length ? Number((passed / results.length).toFixed(3)) : 0,
    results,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
