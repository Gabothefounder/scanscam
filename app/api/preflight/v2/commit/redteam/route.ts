import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { trustedPreflight, type TrustedPreflightRequest } from "@/lib/integrity/trusted";
import {
  commitExecution,
  hashIntegrityValue,
  issueAuthorizationReceipt,
  type AuthorizationReceipt,
} from "@/lib/integrity/receipts";
import {
  createIntegrityClient,
  issueIntegrityClientCredential,
  authenticateIntegrityApiKey,
  type IntegrityClientIdentity,
} from "@/lib/integrity/auth";

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
  client: IntegrityClientIdentity,
  options?: { ttlSeconds?: number }
): Promise<AuthorizationReceipt> {
  const preflight = await trustedPreflight(request);
  if (preflight.decision !== "ALLOW") {
    throw new Error(`redteam_preflight_not_allow:${preflight.decision}`);
  }
  return issueAuthorizationReceipt(request, preflight, client, options);
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = crypto.randomUUID();
  const subjectId = `commit-redteam-${suffix}`;
  const noBaselineSubject = `commit-redteam-new-${suffix}`;
  const stalePrincipal = `commit-redteam-principal-${suffix}`;
  const staleSubject = `commit-redteam-mandate-subject-${suffix}`;
  const results: Result[] = [];
  const authorizationIds: string[] = [];
  let testClientId: string | null = null;

  let baselineState: Record<string, any> = {
    vendor: { bank_account: "RBC-RT", typical_amount: 100, status: "active" },
  };

  try {
    const createdClient = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `commit-redteam-client-${suffix}`,
      scopes: ["preflight:write", "commit:write"],
      metadata: { redteam: true },
    });
    testClientId = createdClient.client_id;
    const credential = await issueIntegrityClientCredential({ client_id: createdClient.client_id });
    const identity = await authenticateIntegrityApiKey(credential.api_key, "preflight:write");

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

    // 1. Exact action commits once without rewriting an unchanged baseline.
    const auth1 = await authorize(baseRequest(), identity);
    authorizationIds.push(auth1.id);
    const commit1 = await commitExecution({
      authorization_id: auth1.id,
      authorization_token: auth1.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      external_execution_id: `rt-valid-${suffix}`,
    }, identity);
    const { data: afterCommit1 } = await supabase
      .from("integrity_baselines")
      .select("version,state_hash")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .single();
    results.push({
      id: "exact-action-commit",
      passed:
        commit1.ok === true &&
        commit1.replayed === false &&
        commit1.baseline_version_after === 1 &&
        Number(afterCommit1?.version) === 1,
      expected: "ok / execution receipt / baseline remains v1",
      actual: JSON.stringify({ commit1, baseline: afterCommit1 }),
    });

    // 2. Identical network retry returns the original receipt, with no second state transition.
    const replay = await commitExecution({
      authorization_id: auth1.id,
      authorization_token: auth1.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
    }, identity);
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
        Number(afterReplay?.version) === 1,
      expected: "same execution receipt / baseline remains v1",
      actual: JSON.stringify({ replay, baseline: afterReplay }),
    });

    // 3. Action tampering is rejected.
    const auth2 = await authorize(baseRequest(), identity);
    authorizationIds.push(auth2.id);
    const tampered = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: auth2.token,
      executed_action: { ...baseRequest().proposed_action, amount: 101 },
      outcome: "succeeded",
    }, identity);
    results.push({
      id: "action-tamper-blocked",
      passed: tampered.ok === false && tampered.error === "executed_action_mismatch",
      expected: "executed_action_mismatch",
      actual: JSON.stringify(tampered),
    });

    // 4. A receipt ID without its bearer token is insufficient.
    const badToken = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: crypto.randomBytes(32).toString("base64url"),
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
    }, identity);
    results.push({
      id: "invalid-token-blocked",
      passed: badToken.ok === false && badToken.error === "authorization_token_invalid",
      expected: "authorization_token_invalid",
      actual: JSON.stringify(badToken),
    });

    // 5. Rejected tamper/token attempts do not destroy the legitimate receipt.
    const recovered = await commitExecution({
      authorization_id: auth2.id,
      authorization_token: auth2.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      external_execution_id: `rt-recovered-${suffix}`,
    }, identity);
    results.push({
      id: "valid-retry-after-rejected-attacks",
      passed: recovered.ok === true && recovered.baseline_version_after === 1,
      expected: "ok / baseline remains v1",
      actual: JSON.stringify(recovered),
    });

    // 6. The agent cannot poison history with an arbitrary post-execution state.
    const auth3 = await authorize(baseRequest(), identity);
    authorizationIds.push(auth3.id);
    const maliciousState = {
      vendor: { ...baselineState.vendor, bank_account: "ATTACKER-ACCOUNT" },
    };
    const poisoned = await commitExecution({
      authorization_id: auth3.id,
      authorization_token: auth3.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
      resulting_state: maliciousState,
    }, identity);
    results.push({
      id: "arbitrary-resulting-state-blocked",
      passed: poisoned.ok === false && poisoned.error === "resulting_state_not_authorized",
      expected: "resulting_state_not_authorized",
      actual: JSON.stringify(poisoned),
    });

    // 7. An exact benign state transition already evaluated at Preflight may advance the baseline.
    const transitionState = {
      vendor: { ...baselineState.vendor, display_label: "Verified Supplier" },
    };
    const transitionRequest: TrustedPreflightRequest = {
      ...baseRequest(),
      current_state: transitionState,
    };
    const transitionAuth = await authorize(transitionRequest, identity);
    authorizationIds.push(transitionAuth.id);
    const transitionCommit = await commitExecution({
      authorization_id: transitionAuth.id,
      authorization_token: transitionAuth.token,
      executed_action: transitionRequest.proposed_action,
      outcome: "succeeded",
      resulting_state: transitionState,
      external_execution_id: `rt-transition-${suffix}`,
    }, identity);
    const { data: afterTransition } = await supabase
      .from("integrity_baselines")
      .select("version,state_hash")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .single();
    results.push({
      id: "preflight-bound-state-transition",
      passed:
        transitionCommit.ok === true &&
        transitionCommit.baseline_version_after === 2 &&
        Number(afterTransition?.version) === 2 &&
        afterTransition?.state_hash === hashIntegrityValue(transitionState),
      expected: "exact preflight state / baseline v2",
      actual: JSON.stringify({ transitionCommit, baseline: afterTransition }),
    });
    baselineState = transitionState;

    // 8. If Preflight approved a state transition, successful Commit cannot omit that state.
    const transitionState2 = {
      vendor: { ...baselineState.vendor, display_note: "routine-update" },
    };
    const transitionRequest2: TrustedPreflightRequest = {
      ...baseRequest(),
      current_state: transitionState2,
    };
    const missingStateAuth = await authorize(transitionRequest2, identity);
    authorizationIds.push(missingStateAuth.id);
    const missingState = await commitExecution({
      authorization_id: missingStateAuth.id,
      authorization_token: missingStateAuth.token,
      executed_action: transitionRequest2.proposed_action,
      outcome: "succeeded",
    }, identity);
    results.push({
      id: "required-authorized-state-missing",
      passed: missingState.ok === false && missingState.error === "resulting_state_required",
      expected: "resulting_state_required",
      actual: JSON.stringify(missingState),
    });

    // 9. Receipt becomes invalid if authoritative history moved since authorization.
    const staleAuth = await authorize(baseRequest(), identity);
    authorizationIds.push(staleAuth.id);
    const concurrentState = {
      vendor: { ...baselineState.vendor, concurrent_change: "another authorized execution" },
    };
    const { error: concurrentError } = await supabase
      .from("integrity_baselines")
      .update({
        version: 3,
        state: concurrentState,
        state_hash: hashIntegrityValue(concurrentState),
        updated_at: new Date().toISOString(),
      })
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .eq("version", 2);
    if (concurrentError) throw new Error("redteam_concurrent_update_failed");
    baselineState = concurrentState;

    const stale = await commitExecution({
      authorization_id: staleAuth.id,
      authorization_token: staleAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
    }, identity);
    results.push({
      id: "stale-baseline-blocked",
      passed: stale.ok === false && stale.error === "authorization_stale_baseline",
      expected: "authorization_stale_baseline",
      actual: JSON.stringify(stale),
    });

    // 10. Expired authorization cannot execute.
    const expiredAuth = await authorize(baseRequest(), identity, { ttlSeconds: -1 });
    authorizationIds.push(expiredAuth.id);
    const expired = await commitExecution({
      authorization_id: expiredAuth.id,
      authorization_token: expiredAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "succeeded",
    }, identity);
    results.push({
      id: "expired-authorization-blocked",
      passed: expired.ok === false && expired.error === "authorization_expired",
      expected: "authorization_expired",
      actual: JSON.stringify(expired),
    });

    // 11. Failed execution consumes the receipt and does not move history.
    const failedAuth = await authorize(baseRequest(), identity);
    authorizationIds.push(failedAuth.id);
    const failedCommit = await commitExecution({
      authorization_id: failedAuth.id,
      authorization_token: failedAuth.token,
      executed_action: baseRequest().proposed_action,
      outcome: "failed",
      external_execution_id: `rt-failed-${suffix}`,
    }, identity);
    const { data: afterFailure } = await supabase
      .from("integrity_baselines")
      .select("version,state_hash")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", subjectId)
      .single();
    results.push({
      id: "failed-execution-no-state-advance",
      passed:
        failedCommit.ok === true &&
        failedCommit.baseline_version_after === 3 &&
        Number(afterFailure?.version) === 3,
      expected: "consumed / baseline remains v3",
      actual: JSON.stringify({ failedCommit, baseline: afterFailure }),
    });

    // 12. A policy revision after authorization invalidates the old receipt.
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
    const mandateAuth = await authorize(staleMandateRequest, identity);
    authorizationIds.push(mandateAuth.id);
    await supabase.from("integrity_mandates").update({ active: false })
      .eq("principal_id", stalePrincipal).eq("version", 1);
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
    }, identity);
    results.push({
      id: "stale-mandate-blocked",
      passed:
        staleMandateCommit.ok === false &&
        staleMandateCommit.error === "authorization_stale_mandate",
      expected: "authorization_stale_mandate",
      actual: JSON.stringify(staleMandateCommit),
    });

    // 13. Commit cannot bootstrap a brand-new trusted baseline from caller-supplied state.
    const newSubjectRequest: TrustedPreflightRequest = {
      principal_id: "demo-gabriel",
      subject_id: noBaselineSubject,
      proposed_action: {
        type: "send_payment",
        amount: 25,
        currency: "CAD",
        counterparty_id: noBaselineSubject,
      },
      trace_excerpt: "Pay a small first-time 25 CAD invoice.",
      semantic_mode: "off",
    };
    const noBaselineAuth = await authorize(newSubjectRequest, identity);
    authorizationIds.push(noBaselineAuth.id);
    const bootstrapAttempt = await commitExecution({
      authorization_id: noBaselineAuth.id,
      authorization_token: noBaselineAuth.token,
      executed_action: newSubjectRequest.proposed_action,
      outcome: "succeeded",
      resulting_state: { vendor: { bank_account: "CALLER-CONTROLLED" } },
    }, identity);
    const { data: bootstrappedBaseline } = await supabase
      .from("integrity_baselines")
      .select("version")
      .eq("principal_id", "demo-gabriel")
      .eq("subject_id", noBaselineSubject)
      .maybeSingle();
    results.push({
      id: "caller-cannot-bootstrap-baseline",
      passed:
        bootstrapAttempt.ok === false &&
        bootstrapAttempt.error === "resulting_state_not_authorized" &&
        !bootstrappedBaseline,
      expected: "state rejected / no baseline created",
      actual: JSON.stringify({ bootstrapAttempt, baseline: bootstrappedBaseline }),
    });
  } catch (error) {
    results.push({
      id: "suite-runtime",
      passed: false,
      expected: "no runtime error",
      actual: error instanceof Error ? error.message : "unknown_error",
    });
  } finally {
    if (authorizationIds.length) {
      await supabase.from("integrity_execution_receipts").delete().in("authorization_id", authorizationIds);
      await supabase.from("integrity_authorizations").delete().in("id", authorizationIds);
    }

    await supabase.from("integrity_baselines").delete()
      .eq("principal_id", "demo-gabriel")
      .in("subject_id", [subjectId, noBaselineSubject]);

    await supabase.from("integrity_baselines").delete()
      .eq("principal_id", stalePrincipal)
      .eq("subject_id", staleSubject);

    await supabase.from("integrity_mandates").delete()
      .eq("principal_id", stalePrincipal);

    if (testClientId) {
      await supabase.from("integrity_clients").delete().eq("id", testClientId);
    }
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
