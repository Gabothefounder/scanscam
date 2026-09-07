import { createClient } from "@supabase/supabase-js";
import type { IntegrityClientIdentity } from "./auth";
import { hashIntegrityValue } from "./canonical";
import type { Primitive } from "./preflight";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type AttestationIssueRequest = {
  claim_text: string;
  evidence?: Record<string, Primitive>;
  observed_at?: string;
  expires_at?: string | null;
};

export function isAttestationIssueRequest(value: unknown): value is AttestationIssueRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<AttestationIssueRequest>;
  return typeof body.claim_text === "string" && body.claim_text.trim().length > 0;
}

export async function issueIntegrityAttestation(
  request: AttestationIssueRequest,
  verifier: IntegrityClientIdentity
): Promise<{
  id: string;
  claim_text: string;
  issuer: string;
  trust_level: "principal_verifier";
  observed_at: string;
  expires_at: string | null;
}> {
  if (!["verifier", "hybrid"].includes(verifier.kind)) {
    throw new Error("integrity_verifier_kind_required");
  }

  const claimText = request.claim_text.trim().slice(0, 500);
  const evidence = request.evidence ?? {};
  if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > 32_000) {
    throw new Error("integrity_attestation_evidence_too_large");
  }

  const observedAt =
    request.observed_at && Number.isFinite(Date.parse(request.observed_at))
      ? new Date(request.observed_at).toISOString()
      : new Date().toISOString();

  const expiresAt =
    request.expires_at && Number.isFinite(Date.parse(request.expires_at))
      ? new Date(request.expires_at).toISOString()
      : null;

  const issuer = `client:${verifier.client_id}:${verifier.name}`;

  const { data, error } = await supabase
    .from("integrity_attestations")
    .insert({
      principal_id: verifier.principal_id,
      claim_text: claimText,
      claim_hash: hashIntegrityValue(claimText.toLowerCase()),
      issuer,
      issuer_client_id: verifier.client_id,
      trust_level: "principal_verifier",
      evidence,
      evidence_hash: hashIntegrityValue(evidence),
      observed_at: observedAt,
      expires_at: expiresAt,
    })
    .select("id,claim_text,issuer,trust_level,observed_at,expires_at")
    .single();

  if (error || !data) throw new Error("integrity_attestation_issue_failed");

  return {
    id: String(data.id),
    claim_text: String(data.claim_text),
    issuer: String(data.issuer),
    trust_level: "principal_verifier",
    observed_at: String(data.observed_at),
    expires_at: data.expires_at ? String(data.expires_at) : null,
  };
}
