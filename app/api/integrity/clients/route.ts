import {
  assertIntegrityClientOwnedByPrincipal,
  authenticateIntegrityRequest,
  createIntegrityClient,
  integrityAuthHttpStatus,
  issueIntegrityClientCredential,
  listIntegrityClientsForPrincipal,
  revokeIntegrityClient,
  revokeIntegrityClientCredential,
  rotateIntegrityClientCredential,
  type IntegrityClientKind,
  type IntegrityScope,
} from "@/lib/integrity/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SCOPES = new Set<IntegrityScope>([
  "preflight:write",
  "commit:write",
  "clients:manage",
  "observe:write",
  "attest:write",
]);

const ALLOWED_KINDS = new Set<IntegrityClientKind>([
  "actor",
  "observer",
  "manager",
  "verifier",
  "hybrid",
]);

function parseScopes(value: unknown): IntegrityScope[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const scopes = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  if (!scopes.length || scopes.some((scope) => !ALLOWED_SCOPES.has(scope as IntegrityScope))) return null;
  return scopes as IntegrityScope[];
}

async function manager(request: Request) {
  try {
    return await authenticateIntegrityRequest(request, "clients:manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    throw Object.assign(new Error(message), { status: integrityAuthHttpStatus(message) });
  }
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  try {
    const identity = await manager(request);
    const clients = await listIntegrityClientsForPrincipal(identity.principal_id);
    return Response.json({
      principal_id: identity.principal_id,
      manager_client_id: identity.client_id,
      clients,
    }, {
      headers: { "Cache-Control": "no-store", "X-ScanScam-Integrity-Version": "0.4" },
    });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "integrity_manager_failed" }, { status });
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let identity;
  try {
    identity = await manager(request);
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({ error: error instanceof Error ? error.message : "integrity_manager_failed" }, { status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    switch (body?.action) {
      case "create_client": {
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
        const scopes = parseScopes(body.scopes);
        const kind =
          typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind as IntegrityClientKind)
            ? (body.kind as IntegrityClientKind)
            : "actor";
        if (!name || !scopes) {
          return Response.json({ error: "invalid_client_definition" }, { status: 400 });
        }

        const created = await createIntegrityClient({
          principal_id: identity.principal_id,
          name,
          scopes,
          kind,
          metadata: {
            created_by_client_id: identity.client_id,
          },
        });

        const credential = await issueIntegrityClientCredential({
          client_id: created.client_id,
          expires_at:
            typeof body.expires_at === "string" && Number.isFinite(Date.parse(body.expires_at))
              ? new Date(body.expires_at).toISOString()
              : null,
          metadata: {
            created_by_client_id: identity.client_id,
          },
        });

        return Response.json({
          client_id: created.client_id,
          principal_id: identity.principal_id,
          name,
          kind,
          scopes,
          credential: {
            credential_id: credential.credential_id,
            api_key: credential.api_key,
            key_prefix: credential.key_prefix,
            expires_at: credential.expires_at,
            shown_once: true,
          },
        }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }

      case "rotate_credential": {
        const clientId = typeof body.client_id === "string" ? body.client_id : "";
        if (!clientId) return Response.json({ error: "client_id_required" }, { status: 400 });

        await assertIntegrityClientOwnedByPrincipal(clientId, identity.principal_id);
        const next = await rotateIntegrityClientCredential({
          client_id: clientId,
          revoke_credential_id:
            typeof body.revoke_credential_id === "string"
              ? body.revoke_credential_id
              : undefined,
          expires_at:
            typeof body.expires_at === "string" && Number.isFinite(Date.parse(body.expires_at))
              ? new Date(body.expires_at).toISOString()
              : null,
        });

        return Response.json({
          client_id: clientId,
          credential: {
            credential_id: next.credential_id,
            api_key: next.api_key,
            key_prefix: next.key_prefix,
            expires_at: next.expires_at,
            shown_once: true,
          },
        }, { headers: { "Cache-Control": "no-store" } });
      }

      case "revoke_credential": {
        const clientId = typeof body.client_id === "string" ? body.client_id : "";
        const credentialId = typeof body.credential_id === "string" ? body.credential_id : "";
        if (!clientId || !credentialId) {
          return Response.json({ error: "client_and_credential_required" }, { status: 400 });
        }

        await assertIntegrityClientOwnedByPrincipal(clientId, identity.principal_id);
        await revokeIntegrityClientCredential(clientId, credentialId);
        return Response.json({ ok: true, client_id: clientId, credential_id: credentialId });
      }

      case "revoke_client": {
        const clientId = typeof body.client_id === "string" ? body.client_id : "";
        if (!clientId) return Response.json({ error: "client_id_required" }, { status: 400 });
        if (clientId === identity.client_id) {
          return Response.json({ error: "manager_cannot_revoke_itself" }, { status: 409 });
        }

        await assertIntegrityClientOwnedByPrincipal(clientId, identity.principal_id);
        await revokeIntegrityClient(clientId);
        return Response.json({ ok: true, client_id: clientId, status: "revoked" });
      }

      default:
        return Response.json({
          error: "unknown_management_action",
          actions: ["create_client", "rotate_credential", "revoke_credential", "revoke_client"],
        }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_manager_failed";
    const status = message === "integrity_client_not_found" ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
