import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertIntegrityClientOwnedByPrincipal,
  authenticateIntegrityApiKey,
  createIntegrityClient,
  issueIntegrityClientCredential,
  revokeIntegrityClient,
  revokeIntegrityClientCredential,
  rotateIntegrityClientCredential,
  type IntegrityClientIdentity,
} from "@/lib/integrity/auth";
import {
  bindAuthenticatedPrincipal,
  trustedPreflight,
  type UnboundTrustedPreflightRequest,
} from "@/lib/integrity/trusted";
import {
  commitExecution,
  hashIntegrityValue,
  issueAuthorizationReceipt,
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

function push(
  results: Result[],
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

async function expectAuthError(
  apiKey: string,
  scope: "preflight:write" | "commit:write" | "clients:manage"
): Promise<string> {
  try {
    await authenticateIntegrityApiKey(apiKey, scope);
    return "NO_ERROR";
  } catch (error) {
    return error instanceof Error ? error.message : "unknown_error";
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const suffix = crypto.randomUUID();
  const subjectId = `identity-redteam-subject-${suffix}`;
  const subjectState = { vendor: { bank_account: "RBC-IDENTITY", typical_amount: 300 } };
  const results: Result[] = [];
  const clientIds: string[] = [];
  const authorizationIds: string[] = [];

  try {
    const clientA = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-a-${suffix}`,
      scopes: ["preflight:write", "commit:write"],
      metadata: { redteam: true },
    });
    clientIds.push(clientA.client_id);
    const credA = await issueIntegrityClientCredential({ client_id: clientA.client_id });
    const identityA = await authenticateIntegrityApiKey(credA.api_key, "preflight:write");

    push(
      results,
      "valid-key-resolves-principal",
      identityA.principal_id === "demo-gabriel" && identityA.client_id === clientA.client_id,
      "authenticated client resolves demo-gabriel",
      identityA
    );

    await supabase.from("integrity_baselines").insert({
      principal_id: "demo-gabriel",
      subject_id: subjectId,
      version: 1,
      state: subjectState,
      state_hash: hashIntegrityValue(subjectState),
    });

    const spoofedBody: UnboundTrustedPreflightRequest = {
      principal_id: "attacker-selected-principal",
      subject_id: subjectId,
      proposed_action: {
        type: "send_payment",
        amount: 300,
        currency: "CAD",
        counterparty_id: subjectId,
      },
      current_state: subjectState,
      trace_excerpt: "Pay the routine invoice to the established supplier account.",
      semantic_mode: "off",
    };
    const bound = bindAuthenticatedPrincipal(spoofedBody, identityA);
    const spoofResult = await trustedPreflight(bound, spoofedBody as Record<string, unknown>);
    push(
      results,
      "body-principal-spoof-ignored",
      bound.principal_id === "demo-gabriel" &&
        spoofResult.trust.ignored_client_authority.includes("principal_id"),
      "body principal ignored; authenticated principal wins",
      {
        bound_principal: bound.principal_id,
        ignored: spoofResult.trust.ignored_client_authority,
        decision: spoofResult.decision,
      }
    );

    const preflightOnly = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-preflight-only-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(preflightOnly.client_id);
    const preflightOnlyCred = await issueIntegrityClientCredential({ client_id: preflightOnly.client_id });
    const scopeError = await expectAuthError(preflightOnlyCred.api_key, "commit:write");
    push(
      results,
      "scope-denial",
      scopeError === "integrity_scope_denied",
      "integrity_scope_denied",
      scopeError
    );

    const expiredClient = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-expired-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(expiredClient.client_id);
    const expiredCred = await issueIntegrityClientCredential({
      client_id: expiredClient.client_id,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const expiredError = await expectAuthError(expiredCred.api_key, "preflight:write");
    push(
      results,
      "expired-credential-denied",
      expiredError === "integrity_auth_expired",
      "integrity_auth_expired",
      expiredError
    );

    const revokedClient = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-revoked-credential-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(revokedClient.client_id);
    const revokedCred = await issueIntegrityClientCredential({ client_id: revokedClient.client_id });
    await revokeIntegrityClientCredential(revokedClient.client_id, revokedCred.credential_id);
    const revokedError = await expectAuthError(revokedCred.api_key, "preflight:write");
    push(
      results,
      "revoked-credential-denied",
      revokedError === "integrity_auth_invalid",
      "integrity_auth_invalid",
      revokedError
    );

    const rotateClient = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-rotate-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(rotateClient.client_id);
    const oldCred = await issueIntegrityClientCredential({ client_id: rotateClient.client_id });
    const newCred = await rotateIntegrityClientCredential({
      client_id: rotateClient.client_id,
      revoke_credential_id: oldCred.credential_id,
    });
    const oldError = await expectAuthError(oldCred.api_key, "preflight:write");
    const newIdentity = await authenticateIntegrityApiKey(newCred.api_key, "preflight:write");
    push(
      results,
      "credential-rotation",
      oldError === "integrity_auth_invalid" && newIdentity.client_id === rotateClient.client_id,
      "old key revoked; new key authenticates same client",
      { old_error: oldError, new_client_id: newIdentity.client_id }
    );

    const wholeClient = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-client-revoke-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(wholeClient.client_id);
    const wholeClientCred = await issueIntegrityClientCredential({ client_id: wholeClient.client_id });
    await revokeIntegrityClient(wholeClient.client_id);
    const wholeClientError = await expectAuthError(wholeClientCred.api_key, "preflight:write");
    push(
      results,
      "client-revocation",
      wholeClientError === "integrity_auth_invalid" || wholeClientError === "integrity_client_inactive",
      "revoked client can no longer authenticate",
      wholeClientError
    );

    const clientB = await createIntegrityClient({
      principal_id: "demo-gabriel",
      name: `identity-redteam-b-${suffix}`,
      scopes: ["preflight:write", "commit:write"],
      metadata: { redteam: true },
    });
    clientIds.push(clientB.client_id);
    const credB = await issueIntegrityClientCredential({ client_id: clientB.client_id });
    const identityB = await authenticateIntegrityApiKey(credB.api_key, "commit:write");

    const safeRequest = bindAuthenticatedPrincipal(spoofedBody, identityA);
    const preflight = await trustedPreflight(safeRequest, spoofedBody as Record<string, unknown>);
    if (preflight.decision !== "ALLOW") throw new Error(`identity_redteam_not_allow:${preflight.decision}`);
    const authorization = await issueAuthorizationReceipt(safeRequest, preflight, identityA);
    authorizationIds.push(authorization.id);

    const stolenCommit = await commitExecution({
      authorization_id: authorization.id,
      authorization_token: authorization.token,
      executed_action: safeRequest.proposed_action,
      outcome: "succeeded",
    }, identityB);

    const legitimateCommit = await commitExecution({
      authorization_id: authorization.id,
      authorization_token: authorization.token,
      executed_action: safeRequest.proposed_action,
      outcome: "succeeded",
    }, identityA);

    push(
      results,
      "cross-client-receipt-theft-blocked",
      stolenCommit.ok === false &&
        stolenCommit.error === "authorization_client_mismatch" &&
        legitimateCommit.ok === true,
      "other client rejected; issuing client can commit",
      { stolenCommit, legitimateCommit }
    );

    const otherPrincipalClient = await createIntegrityClient({
      principal_id: `other-principal-${suffix}`,
      name: `identity-redteam-other-principal-${suffix}`,
      scopes: ["preflight:write"],
      metadata: { redteam: true },
    });
    clientIds.push(otherPrincipalClient.client_id);
    let ownershipError = "NO_ERROR";
    try {
      await assertIntegrityClientOwnedByPrincipal(otherPrincipalClient.client_id, "demo-gabriel");
    } catch (error) {
      ownershipError = error instanceof Error ? error.message : "unknown_error";
    }
    push(
      results,
      "manager-cross-principal-target-blocked",
      ownershipError === "integrity_client_not_found",
      "integrity_client_not_found",
      ownershipError
    );

    const garbageError = await expectAuthError("ssi_v1_not-a-real-key-material-at-all", "preflight:write");
    push(
      results,
      "unknown-key-denied",
      garbageError === "integrity_auth_invalid",
      "integrity_auth_invalid",
      garbageError
    );

    push(
      results,
      "raw-key-never-returned-from-authentication",
      !("api_key" in (identityA as unknown as Record<string, unknown>)),
      "authenticated identity contains no raw API key",
      Object.keys(identityA)
    );
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
      .eq("subject_id", subjectId);

    if (clientIds.length) {
      await supabase.from("integrity_clients").delete().in("id", clientIds);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "principal-agent-identity-v0.4",
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
