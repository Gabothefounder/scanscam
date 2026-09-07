import { createClient } from "@supabase/supabase-js";
import type { IntegrityClientIdentity } from "./auth";
import { actionEnvelopeToProposedAction } from "./action-envelope";
import { hashIntegrityValue } from "./canonical";
import {
  runIntegrityV05,
  type IntegrityV05Result,
  type IntegrityV05RuntimeOptions,
} from "./v05";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type IntegrityChallenge = {
  id: string;
  status: "open" | "satisfied" | "closed" | "expired" | "cancelled";
  observation_id: string;
  requirements: IntegrityV05Result["challenge_requirements"];
  expires_at: string;
  retry_count: number;
};

export async function persistIntegrityChallenge(
  result: IntegrityV05Result,
  actor: IntegrityClientIdentity
): Promise<IntegrityChallenge | null> {
  if (result.disposition !== "CHALLENGE") return null;

  const actionHash = hashIntegrityValue(actionEnvelopeToProposedAction(result.action));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { data: existing } = await supabase
    .from("integrity_challenges")
    .select("id,status,observation_id,requirements,expires_at,retry_count")
    .eq("client_id", actor.client_id)
    .eq("observation_id", result.trust.observation_id)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("integrity_challenges")
      .update({
        requirements: result.challenge_requirements,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id,status,observation_id,requirements,expires_at,retry_count")
      .single();

    if (error || !data) throw new Error("integrity_challenge_update_failed");
    return data as IntegrityChallenge;
  }

  const { data, error } = await supabase
    .from("integrity_challenges")
    .insert({
      principal_id: actor.principal_id,
      client_id: actor.client_id,
      observation_id: result.trust.observation_id,
      action_hash: actionHash,
      status: "open",
      requirements: result.challenge_requirements,
      expires_at: expiresAt,
    })
    .select("id,status,observation_id,requirements,expires_at,retry_count")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      const { data: raced, error: racedError } = await supabase
        .from("integrity_challenges")
        .select("id,status,observation_id,requirements,expires_at,retry_count")
        .eq("client_id", actor.client_id)
        .eq("observation_id", result.trust.observation_id)
        .eq("status", "open")
        .single();
      if (!racedError && raced) return raced as IntegrityChallenge;
    }
    throw new Error("integrity_challenge_create_failed");
  }

  return data as IntegrityChallenge;
}

export async function retryIntegrityChallenge(
  challengeId: string,
  attestationIds: string[],
  actor: IntegrityClientIdentity,
  options?: IntegrityV05RuntimeOptions
): Promise<{ challenge: IntegrityChallenge; result: IntegrityV05Result }> {
  if (!UUID_RE.test(challengeId)) throw new Error("integrity_challenge_id_invalid");
  if (attestationIds.some((id) => !UUID_RE.test(id))) {
    throw new Error("integrity_attestation_id_invalid");
  }

  const { data: row, error } = await supabase
    .from("integrity_challenges")
    .select("id,principal_id,client_id,observation_id,status,requirements,attestation_ids,retry_count,expires_at")
    .eq("id", challengeId)
    .eq("principal_id", actor.principal_id)
    .eq("client_id", actor.client_id)
    .maybeSingle();

  if (error) throw new Error("integrity_challenge_lookup_failed");
  if (!row) throw new Error("integrity_challenge_not_found");
  if (row.status !== "open") throw new Error("integrity_challenge_not_open");

  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    await supabase
      .from("integrity_challenges")
      .update({ status: "expired", updated_at: new Date().toISOString(), resolved_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "open");
    throw new Error("integrity_challenge_expired");
  }

  const priorIds = Array.isArray(row.attestation_ids) ? row.attestation_ids.map(String) : [];
  const allIds = [...new Set([...priorIds, ...attestationIds])];

  const result = await runIntegrityV05(
    {
      observation_id: String(row.observation_id),
      attestation_ids: allIds,
    },
    actor,
    options
  );

  const nextStatus: IntegrityChallenge["status"] =
    result.disposition === "CHALLENGE"
      ? "open"
      : result.disposition === "ALLOW"
        ? "satisfied"
        : "closed";

  const resolvedAt = nextStatus === "open" ? null : new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("integrity_challenges")
    .update({
      status: nextStatus,
      requirements: result.challenge_requirements,
      attestation_ids: allIds,
      retry_count: Number(row.retry_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
      resolved_at: resolvedAt,
    })
    .eq("id", row.id)
    .eq("status", "open")
    .select("id,status,observation_id,requirements,expires_at,retry_count")
    .single();

  if (updateError || !updated) throw new Error("integrity_challenge_update_failed");

  return {
    challenge: updated as IntegrityChallenge,
    result,
  };
}
