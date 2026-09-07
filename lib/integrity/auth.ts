import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type IntegrityScope =
  | "preflight:write"
  | "commit:write"
  | "clients:manage"
  | "observe:write"
  | "attest:write";

export type IntegrityClientKind = "actor" | "observer" | "manager" | "verifier" | "hybrid";

export type IntegrityClientIdentity = {
  client_id: string;
  principal_id: string;
  name: string;
  kind: IntegrityClientKind;
  scopes: IntegrityScope[];
  credential_id: string;
};

export type IssuedIntegrityCredential = {
  client_id: string;
  credential_id: string;
  api_key: string;
  key_prefix: string;
  expires_at: string | null;
};

function keyHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function createIntegrityClient(input: {
  principal_id: string;
  name: string;
  scopes?: IntegrityScope[];
  kind?: IntegrityClientKind;
  metadata?: Record<string, unknown>;
}): Promise<{ client_id: string }> {
  const scopes = input.scopes ?? ["preflight:write", "commit:write"];
  const { data, error } = await supabase
    .from("integrity_clients")
    .insert({
      principal_id: input.principal_id,
      name: input.name,
      scopes,
      kind: input.kind ?? "actor",
      status: "active",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("integrity_client_create_failed");
  return { client_id: String(data.id) };
}

export async function issueIntegrityClientCredential(input: {
  client_id: string;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<IssuedIntegrityCredential> {
  const apiKey = `ssi_v1_${crypto.randomBytes(32).toString("base64url")}`;
  const prefix = apiKey.slice(0, 15);

  const { data, error } = await supabase
    .from("integrity_client_credentials")
    .insert({
      client_id: input.client_id,
      key_hash: keyHash(apiKey),
      key_prefix: prefix,
      expires_at: input.expires_at ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id,client_id,key_prefix,expires_at")
    .single();

  if (error || !data) throw new Error("integrity_credential_issue_failed");

  return {
    client_id: String(data.client_id),
    credential_id: String(data.id),
    api_key: apiKey,
    key_prefix: String(data.key_prefix),
    expires_at: data.expires_at ? String(data.expires_at) : null,
  };
}

export async function rotateIntegrityClientCredential(input: {
  client_id: string;
  revoke_credential_id?: string;
  expires_at?: string | null;
}): Promise<IssuedIntegrityCredential> {
  const next = await issueIntegrityClientCredential({
    client_id: input.client_id,
    expires_at: input.expires_at ?? null,
    metadata: { rotated: true },
  });

  if (input.revoke_credential_id) {
    const { error } = await supabase
      .from("integrity_client_credentials")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", input.revoke_credential_id)
      .eq("client_id", input.client_id)
      .is("revoked_at", null);
    if (error) throw new Error("integrity_credential_revoke_failed");
  }

  return next;
}

export async function revokeIntegrityClientCredential(
  clientId: string,
  credentialId: string
): Promise<void> {
  const { error } = await supabase
    .from("integrity_client_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", credentialId)
    .eq("client_id", clientId)
    .is("revoked_at", null);

  if (error) throw new Error("integrity_credential_revoke_failed");
}

export async function revokeIntegrityClient(clientId: string): Promise<void> {
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const { error: clientError } = await supabase
    .from("integrity_clients")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("id", clientId)
    .eq("status", "active");

  if (clientError) throw new Error("integrity_client_revoke_failed");

  const { error: credentialError } = await supabase
    .from("integrity_client_credentials")
    .update({ revoked_at: now })
    .eq("client_id", clientId)
    .is("revoked_at", null);

  if (credentialError) throw new Error("integrity_credential_revoke_failed");
}

export async function authenticateIntegrityApiKey(
  apiKey: string,
  requiredScope: IntegrityScope
): Promise<IntegrityClientIdentity> {
  if (!apiKey.startsWith("ssi_v1_") || apiKey.length < 30) {
    throw new Error("integrity_auth_invalid");
  }

  const { data, error } = await supabase.rpc("authenticate_integrity_client", {
    p_key_hash: keyHash(apiKey),
    p_required_scope: requiredScope,
  });

  if (error) throw new Error("integrity_auth_lookup_failed");

  const result = data as
    | {
        ok: true;
        credential_id: string;
        client_id: string;
        principal_id: string;
        name: string;
        kind: IntegrityClientKind;
        scopes: IntegrityScope[];
      }
    | { ok: false; error: string }
    | null;

  if (!result) throw new Error("integrity_auth_lookup_failed");
  if (!result.ok) throw new Error(result.error);

  return {
    client_id: String(result.client_id),
    principal_id: String(result.principal_id),
    name: String(result.name),
    kind: result.kind,
    scopes: result.scopes ?? [],
    credential_id: String(result.credential_id),
  };
}

export async function authenticateIntegrityRequest(
  request: Request,
  requiredScope: IntegrityScope
): Promise<IntegrityClientIdentity> {
  const apiKey = parseBearer(request);
  if (!apiKey) throw new Error("integrity_auth_missing");
  return authenticateIntegrityApiKey(apiKey, requiredScope);
}

export function integrityAuthHttpStatus(error: string): number {
  if (error === "integrity_scope_denied") return 403;
  if (error === "integrity_auth_missing" || error === "integrity_auth_invalid" || error === "integrity_auth_expired") {
    return 401;
  }
  if (error === "integrity_client_inactive") return 401;
  return 500;
}


export async function assertIntegrityClientOwnedByPrincipal(
  clientId: string,
  principalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("integrity_clients")
    .select("id")
    .eq("id", clientId)
    .eq("principal_id", principalId)
    .maybeSingle();

  if (error) throw new Error("integrity_client_lookup_failed");
  if (!data) throw new Error("integrity_client_not_found");
}

export async function listIntegrityClientsForPrincipal(
  principalId: string
): Promise<Array<{
  client_id: string;
  name: string;
  kind: IntegrityClientKind;
  scopes: IntegrityScope[];
  status: string;
  created_at: string;
  revoked_at: string | null;
}>> {
  const { data, error } = await supabase
    .from("integrity_clients")
    .select("id,name,kind,scopes,status,created_at,revoked_at")
    .eq("principal_id", principalId)
    .order("created_at", { ascending: true });

  if (error) throw new Error("integrity_client_lookup_failed");
  return (data ?? []).map((row) => ({
    client_id: String(row.id),
    name: String(row.name),
    kind: String(row.kind ?? "actor") as IntegrityClientKind,
    scopes: (row.scopes ?? []) as IntegrityScope[],
    status: String(row.status),
    created_at: String(row.created_at),
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
  }));
}
