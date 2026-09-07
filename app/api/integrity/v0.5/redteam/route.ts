import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateIntegrityApiKey,
  createIntegrityClient,
  issueIntegrityClientCredential,
  type IntegrityClientIdentity,
} from "@/lib/integrity/auth";
import {
  normalizeObservedToolCall,
  actionEnvelopeToProposedAction,
  type ObservedToolCallInput,
} from "@/lib/integrity/action-envelope";
import { storeRuntimeObservation } from "@/lib/integrity/observer";
import { hashIntegrityValue } from "@/lib/integrity/canonical";
import { runIntegrityV05 } from "@/lib/integrity/v05";
import { commitExecution } from "@/lib/integrity/receipts";
import { issueIntegrityAttestation } from "@/lib/integrity/attest";
import {
  persistIntegrityChallenge,
  retryIntegrityChallenge,
} from "@/lib/integrity/challenge";

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
  kind: "actor" | "observer" | "verifier" | "hybrid";
  scopes: Array<"preflight:write" | "commit:write" | "observe:write" | "attest:write">;
}): Promise<{ identity: IntegrityClientIdentity; apiKey: string }> {
  const created = await createIntegrityClient({
    principal_id: input.principal,
    name: input.name,
    kind: input.kind,
    scopes: input.scopes,
    metadata: { redteam: true },
  });
  const credential = await issueIntegrityClientCredential({ client_id: created.client_id });
  const authScope =
    input.scopes.includes("preflight:write") ? "preflight:write" :
    input.scopes.includes("observe:write") ? "observe:write" :
    "attest:write";
  const identity = await authenticateIntegrityApiKey(credential.api_key, authScope);
  return { identity, apiKey: credential.api_key };
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
  model: "redteam-stub",
});

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = crypto.randomUUID();
  const principal = `guardian-v05-${suffix}`;
  const otherPrincipal = `guardian-v05-other-${suffix}`;
  const results: TestResult[] = [];

  try {
    const actor = await makeClient({
      principal,
      name: "actor",
      kind: "actor",
      scopes: ["preflight:write", "commit:write"],
    });
    const observer = await makeClient({
      principal,
      name: "runtime-observer",
      kind: "observer",
      scopes: ["observe:write"],
    });
    const hybrid = await makeClient({
      principal,
      name: "hybrid-self-observer",
      kind: "hybrid",
      scopes: ["preflight:write", "commit:write", "observe:write"],
    });
    const verifier = await makeClient({
      principal,
      name: "independent-verifier",
      kind: "verifier",
      scopes: ["attest:write"],
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
        {
          id: "prefer-morning-flight",
          field: "context.action_envelope.policy_facts.flight.departure_time",
          operator: "eq",
          value: "09:00",
          mode: "prefer",
          weight: 40,
          private: true,
          reason: "Prefer a morning departure.",
        },
        {
          id: "avoid-red-eye",
          field: "context.action_envelope.policy_facts.flight.red_eye",
          operator: "eq",
          value: true,
          mode: "avoid",
          weight: 50,
          private: true,
          reason: "Avoid red-eye flights.",
        },
      ],
      budgets: [
        {
          id: "hourly-agent-spend",
          limit: 1000,
          currency: "CAD",
          window_seconds: 3600,
          effects: ["financial_transfer"],
          mode: "approval",
        },
      ],
    };

    await supabase.from("integrity_mandates").insert({
      principal_id: principal,
      version: 1,
      mandate,
      mandate_hash: hashIntegrityValue(mandate),
      active: true,
    });

    const safeInput: ObservedToolCallInput = {
      protocol: "acs",
      hook: "toolCallRequest",
      session_id: `safe-${suffix}`,
      step_id: "1",
      goal: "Pay the routine ACME invoice.",
      causal_context: "Routine monthly invoice to the established approved supplier and account.",
      tool: {
        name: "pay_invoice",
        server: "erp.local",
        description: "Pays an approved supplier invoice.",
        schema_hash: "schema-pay-v1",
      },
      arguments: {
        vendor: "ACME",
        amount: 300,
        currency: "CAD",
        bank_account: "RBC-1111",
        supplier_country: "CA",
        flight: {
          departure_time: "09:00",
          red_eye: false,
        },
      },
    };

    const safeNormalized = normalizeObservedToolCall(safeInput);
    const subjectId = safeNormalized.envelope.subject_id;
    if (!subjectId) throw new Error("redteam_subject_missing");

    await supabase.from("integrity_baselines").insert({
      principal_id: principal,
      subject_id: subjectId,
      version: 1,
      state: safeNormalized.state_snapshot,
      state_hash: hashIntegrityValue(safeNormalized.state_snapshot),
    });

    const safeObs = await storeRuntimeObservation(safeInput, observer.identity);
    const safe = await runIntegrityV05(
      { observation_id: safeObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );

    record(
      results,
      "arbitrary-value-policy-safe-action",
      safe.disposition === "ALLOW" &&
        !!safe.authorization &&
        safe.value_guard.preference_score > 0 &&
        safe.value_guard.private_match_count === 2 &&
        !safe.signals.some((signal) => signal.code.startsWith("VALUE_")),
      "ALLOW; private value preferences influence score without leaking preference reasons",
      {
        disposition: safe.disposition,
        value_guard: safe.value_guard,
        public_signal_codes: safe.signals.map((signal) => signal.code),
      }
    );

    if (safe.authorization) {
      await commitExecution({
        authorization_id: safe.authorization.id,
        authorization_token: safe.authorization.token,
        executed_action: actionEnvelopeToProposedAction(safe.action),
        outcome: "failed",
        external_execution_id: `safe-release-${suffix}`,
      }, actor.identity);
    }

    const usObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `us-${suffix}`,
      step_id: "1",
      arguments: {
        ...safeInput.arguments!,
        amount: 100,
        supplier_country: "US",
      },
    }, observer.identity);
    const us = await runIntegrityV05(
      { observation_id: usObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "hard-approval-rule-separate-from-preference",
      us.disposition === "APPROVAL_REQUIRED" && !us.authorization,
      "US preference policy requires principal approval rather than being treated as fraud",
      { disposition: us.disposition, codes: us.signals.map((signal) => signal.code) }
    );

    const blockedObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `blocked-${suffix}`,
      step_id: "1",
      arguments: {
        ...safeInput.arguments!,
        amount: 50,
        vendor_policy: "never",
      },
    }, observer.identity);
    const blocked = await runIntegrityV05(
      { observation_id: blockedObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "explicit-value-rule-can-deny",
      blocked.disposition === "DENY" && !blocked.authorization,
      "explicit hard exclusion produces DENY",
      { disposition: blocked.disposition, codes: blocked.signals.map((signal) => signal.code) }
    );

    const avoidObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `red-eye-${suffix}`,
      step_id: "1",
      arguments: {
        ...safeInput.arguments!,
        amount: 50,
        flight: { departure_time: "23:30", red_eye: true },
      },
    }, observer.identity);
    const avoid = await runIntegrityV05(
      { observation_id: avoidObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "soft-value-avoidance-does-not-block",
      avoid.disposition === "ALLOW" &&
        avoid.value_guard.preference_score < safe.value_guard.preference_score &&
        avoid.value_guard.private_match_count >= 1,
      "soft arbitrary preference lowers utility without becoming a safety block",
      { disposition: avoid.disposition, value_guard: avoid.value_guard }
    );
    if (avoid.authorization) {
      await commitExecution({
        authorization_id: avoid.authorization.id,
        authorization_token: avoid.authorization.token,
        executed_action: actionEnvelopeToProposedAction(avoid.action),
        outcome: "failed",
        external_execution_id: `avoid-release-${suffix}`,
      }, actor.identity);
    }

    const changedBankObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `bank-change-${suffix}`,
      step_id: "1",
      causal_context:
        "ACME says its banking changed after an acquisition and asks us to use the new account immediately.",
      arguments: {
        ...safeInput.arguments!,
        bank_account: "TD-ATTACKER",
      },
    }, observer.identity);
    const changedBank = await runIntegrityV05(
      { observation_id: changedBankObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "trusted-runtime-destination-change-challenged",
      changedBank.disposition === "CHALLENGE" &&
        changedBank.signals.some((signal) => signal.code === "SENSITIVE_STATE_CHANGE") &&
        !changedBank.authorization,
      "actual runtime destination change produces CHALLENGE",
      { disposition: changedBank.disposition, codes: changedBank.signals.map((signal) => signal.code) }
    );

    const unknownObs = await storeRuntimeObservation({
      protocol: "acs",
      hook: "toolCallRequest",
      session_id: `semantic-outage-${suffix}`,
      step_id: "1",
      goal: "Generate a harmless report.",
      causal_context: "The agent selected an unfamiliar tool for the next step.",
      tool: {
        name: "execute_837",
        server: "unknown-tools.local",
        description: "Creates a root-level production operator account with unrestricted write access.",
      },
      arguments: {
        role: "root",
        target: "production",
      },
    }, observer.identity);
    const unknown = await runIntegrityV05(
      { observation_id: unknownObs.id },
      actor.identity,
      { semanticAnalyzer: async () => null }
    );
    record(
      results,
      "semantic-required-fails-closed",
      unknown.disposition === "CHALLENGE" &&
        unknown.signals.some((signal) => signal.code === "SEMANTIC_REQUIRED_UNAVAILABLE"),
      "unknown action cannot ALLOW when required semantic sensor is unavailable",
      { disposition: unknown.disposition, codes: unknown.signals.map((signal) => signal.code) }
    );

    let actorObserveError = "NO_ERROR";
    try {
      await storeRuntimeObservation(safeInput, actor.identity);
    } catch (error) {
      actorObserveError = error instanceof Error ? error.message : "unknown_error";
    }
    record(
      results,
      "actor-cannot-author-runtime-observation",
      actorObserveError === "integrity_observer_kind_required",
      "integrity_observer_kind_required",
      actorObserveError
    );

    const selfObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `self-${suffix}`,
      step_id: "1",
      arguments: { ...safeInput.arguments!, amount: 50 },
    }, hybrid.identity);
    let selfError = "NO_ERROR";
    try {
      await runIntegrityV05(
        { observation_id: selfObs.id },
        hybrid.identity,
        { semanticAnalyzer: safeSemantic }
      );
    } catch (error) {
      selfError = error instanceof Error ? error.message : "unknown_error";
    }
    record(
      results,
      "actor-cannot-spend-self-authored-observation",
      selfError === "integrity_observation_not_independent",
      "integrity_observation_not_independent",
      selfError
    );

    const secretNormalized = normalizeObservedToolCall({
      ...safeInput,
      session_id: `privacy-${suffix}`,
      step_id: "1",
      arguments: {
        vendor: "ACME",
        amount: 10,
        currency: "CAD",
        api_key: "DO-NOT-PERSIST",
        bank_account: "SUPER-SECRET-BANK-ACCOUNT",
        custom_preference_fact: "allowed",
      },
    });
    const secretEnvelopeText = JSON.stringify(secretNormalized.envelope);
    const facts = secretNormalized.envelope.policy_facts ?? {};
    record(
      results,
      "policy-facts-redact-secrets",
      !secretEnvelopeText.includes("DO-NOT-PERSIST") &&
        !secretEnvelopeText.includes("SUPER-SECRET-BANK-ACCOUNT") &&
        typeof facts.bank_account === "string" &&
        String(facts.bank_account).startsWith("sha256:") &&
        facts.custom_preference_fact === "allowed",
      "arbitrary policy facts retained; secrets omitted; sensitive destinations hashed",
      facts
    );

    const budgetInput = (session: string): ObservedToolCallInput => ({
      ...safeInput,
      session_id: session,
      step_id: "1",
      arguments: {
        ...safeInput.arguments!,
        amount: 700,
      },
    });

    const budgetObs1 = await storeRuntimeObservation(budgetInput(`budget-a-${suffix}`), observer.identity);
    const budgetObs2 = await storeRuntimeObservation(budgetInput(`budget-b-${suffix}`), observer.identity);

    const concurrent = await Promise.all([
      runIntegrityV05({ observation_id: budgetObs1.id }, actor.identity, { semanticAnalyzer: safeSemantic }),
      runIntegrityV05({ observation_id: budgetObs2.id }, actor.identity, { semanticAnalyzer: safeSemantic }),
    ]);

    const concurrentDispositions = concurrent.map((item) => item.disposition).sort();
    record(
      results,
      "atomic-concurrent-budget-reservation",
      concurrentDispositions.join(",") === "ALLOW,APPROVAL_REQUIRED" &&
        concurrent.filter((item) => !!item.authorization).length === 1,
      "only one concurrent 700 CAD authorization fits inside a 1000 CAD hourly budget",
      concurrent.map((item) => ({ disposition: item.disposition, budget: item.budget }))
    );

    const allowedBudget = concurrent.find((item) => item.disposition === "ALLOW");
    if (!allowedBudget?.authorization) throw new Error("budget_allowed_authorization_missing");

    const failedBudgetCommit = await commitExecution({
      authorization_id: allowedBudget.authorization.id,
      authorization_token: allowedBudget.authorization.token,
      executed_action: actionEnvelopeToProposedAction(allowedBudget.action),
      outcome: "failed",
      external_execution_id: `budget-failed-${suffix}`,
    }, actor.identity);

    const budgetObs3 = await storeRuntimeObservation(budgetInput(`budget-c-${suffix}`), observer.identity);
    const afterRelease = await runIntegrityV05(
      { observation_id: budgetObs3.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "failed-execution-releases-budget",
      failedBudgetCommit.ok === true &&
        afterRelease.disposition === "ALLOW" &&
        !!afterRelease.authorization,
      "failed execution releases reservation so another 700 CAD can be authorized",
      { failedBudgetCommit, next: afterRelease.disposition }
    );

    if (!afterRelease.authorization) throw new Error("budget_release_authorization_missing");
    const succeeded = await commitExecution({
      authorization_id: afterRelease.authorization.id,
      authorization_token: afterRelease.authorization.token,
      executed_action: actionEnvelopeToProposedAction(afterRelease.action),
      outcome: "succeeded",
      external_execution_id: `budget-success-${suffix}`,
    }, actor.identity);

    const budgetObs4 = await storeRuntimeObservation({
      ...safeInput,
      session_id: `budget-d-${suffix}`,
      step_id: "1",
      arguments: { ...safeInput.arguments!, amount: 400 },
    }, observer.identity);
    const afterCommit = await runIntegrityV05(
      { observation_id: budgetObs4.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    record(
      results,
      "successful-execution-consumes-window-budget",
      succeeded.ok === true &&
        afterCommit.disposition === "APPROVAL_REQUIRED" &&
        afterCommit.budget?.error === "budget_exceeded",
      "700 committed + 400 requested exceeds the 1000 CAD rolling budget",
      { succeeded, next: afterCommit.disposition, budget: afterCommit.budget }
    );

    const challengeObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `challenge-proof-${suffix}`,
      step_id: "1",
      causal_context: "ACME says its banking changed and asks us to use the new account.",
      arguments: {
        ...safeInput.arguments!,
        amount: 100,
        bank_account: "TD-VERIFIED",
      },
    }, observer.identity);

    const challenged = await runIntegrityV05(
      { observation_id: challengeObs.id },
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );
    const persistedChallenge = await persistIntegrityChallenge(challenged, actor.identity);
    const requiredClaim = challenged.challenge_requirements.find(
      (requirement) => requirement.kind === "attestation" && requirement.claim
    )?.claim;

    if (!persistedChallenge || !requiredClaim) {
      throw new Error("challenge_requirement_missing");
    }

    const attestation = await issueIntegrityAttestation({
      claim_text: requiredClaim,
      evidence: {
        method: "out_of_band_verification",
        result: "confirmed",
        verifier_note: "Supplier independently confirmed the new destination.",
      },
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    }, verifier.identity);

    const retried = await retryIntegrityChallenge(
      persistedChallenge.id,
      [attestation.id],
      actor.identity,
      { semanticAnalyzer: safeSemantic }
    );

    record(
      results,
      "challenge-attestation-retry-resolves",
      challenged.disposition === "CHALLENGE" &&
        persistedChallenge.status === "open" &&
        retried.challenge.status === "satisfied" &&
        retried.result.disposition === "ALLOW" &&
        !!retried.result.authorization,
      "CHALLENGE -> verifier attestation -> retry same observation -> ALLOW",
      {
        initial: challenged.disposition,
        requirement: requiredClaim,
        attestation_id: attestation.id,
        challenge_status: retried.challenge.status,
        retry_disposition: retried.result.disposition,
      }
    );

    if (!retried.result.authorization) {
      throw new Error("challenge_authorization_missing");
    }

    await supabase
      .from("integrity_attestations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", attestation.id);

    const revokedEvidenceCommit = await commitExecution({
      authorization_id: retried.result.authorization.id,
      authorization_token: retried.result.authorization.token,
      executed_action: actionEnvelopeToProposedAction(retried.result.action),
      outcome: "succeeded",
    }, actor.identity);

    record(
      results,
      "revoked-attestation-invalidates-authorization",
      revokedEvidenceCommit.ok === false &&
        revokedEvidenceCommit.error === "authorization_attestation_stale",
      "attestation revoked after Preflight blocks Commit",
      revokedEvidenceCommit
    );

    const otherObs = await storeRuntimeObservation({
      ...safeInput,
      session_id: `other-principal-${suffix}`,
      step_id: "1",
    }, otherObserver.identity);
    let crossPrincipalError = "NO_ERROR";
    try {
      await runIntegrityV05(
        { observation_id: otherObs.id },
        actor.identity,
        { semanticAnalyzer: safeSemantic }
      );
    } catch (error) {
      crossPrincipalError = error instanceof Error ? error.message : "unknown_error";
    }
    record(
      results,
      "cross-principal-observation-hidden",
      crossPrincipalError === "trusted_observation_not_found",
      "trusted_observation_not_found",
      crossPrincipalError
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
    const { data: authorizations } = await supabase
      .from("integrity_authorizations")
      .select("id")
      .eq("principal_id", principal);
    const authorizationIds = (authorizations ?? []).map((row) => row.id);

    if (authorizationIds.length) {
      await supabase.from("integrity_execution_receipts").delete().in("authorization_id", authorizationIds);
      await supabase.from("integrity_budget_reservations").delete().in("authorization_id", authorizationIds);
      await supabase.from("integrity_authorizations").delete().in("id", authorizationIds);
    }

    await supabase.from("integrity_challenges").delete().eq("principal_id", principal);
    await supabase.from("integrity_attestations").delete().eq("principal_id", principal);
    await supabase.from("integrity_action_observations").delete().in("principal_id", [principal, otherPrincipal]);
    await supabase.from("integrity_baselines").delete().eq("principal_id", principal);
    await supabase.from("integrity_mandates").delete().eq("principal_id", principal);

    const { data: clients } = await supabase
      .from("integrity_clients")
      .select("id")
      .in("principal_id", [principal, otherPrincipal]);
    const clientIds = (clients ?? []).map((row) => row.id);
    if (clientIds.length) await supabase.from("integrity_clients").delete().in("id", clientIds);
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "integrity-guardian-v0.5",
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
