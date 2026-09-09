import { createClient } from "@supabase/supabase-js";
import type { IntegrityClientIdentity } from "./auth";
import {
  normalizeObservedToolCall,
  type ObservedToolCallInput,
  type ActionEnvelope,
} from "./action-envelope";
import { hashIntegrityValue } from "./canonical";
import type { Primitive } from "./preflight";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type StoredActionObservation = {
  id: string;
  envelope: ActionEnvelope;
  envelope_hash: string;
  state_snapshot: Record<string, Primitive>;
  state_hash: string;
  expires_at: string;
};

export function isObservedToolCallInput(value: unknown): value is ObservedToolCallInput {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<ObservedToolCallInput>;
  if (!body.tool || typeof body.tool !== "object") return false;
  if (typeof body.tool.name !== "string" || !body.tool.name.trim()) return false;
  if (typeof body.protocol !== "string") return false;
  if (!["acs", "mcp", "a2a", "http", "native", "other"].includes(body.protocol)) return false;
  if (body.arguments !== undefined && (!body.arguments || typeof body.arguments !== "object" || Array.isArray(body.arguments))) {
    return false;
  }
  return true;
}

export async function storeRuntimeObservation(
  input: ObservedToolCallInput,
  observer: IntegrityClientIdentity,
  ttlSeconds = 600
): Promise<StoredActionObservation> {
  if (!["observer", "hybrid"].includes(observer.kind)) {
    throw new Error("integrity_observer_kind_required");
  }

  const argumentSize = Buffer.byteLength(JSON.stringify(input.arguments ?? {}), "utf8");
  if (argumentSize > 64_000) throw new Error("integrity_observation_too_large");

  const { envelope, state_snapshot } = normalizeObservedToolCall(input);
  const envelopeHash = hashIntegrityValue(envelope);
  const stateHash = hashIntegrityValue(state_snapshot);
  const expiresAt = new Date(Date.now() + Math.max(30, Math.min(ttlSeconds, 900)) * 1000).toISOString();
  const causalContext = input.causal_context?.trim().slice(0, 2400) || null;

  const { data, error } = await supabase
    .from("integrity_action_observations")
    .insert({
      principal_id: observer.principal_id,
      observer_client_id: observer.client_id,
      protocol: envelope.tool.protocol,
      hook: envelope.tool.hook,
      session_id: input.session_id?.slice(0, 240) || null,
      step_id: input.step_id?.slice(0, 240) || null,
      envelope,
      envelope_hash: envelopeHash,
      state_snapshot,
      state_hash: stateHash,
      causal_context: causalContext,
      expires_at: expiresAt,
      metadata: {
        privacy: "raw_tool_arguments_not_persisted",
      },
    })
    .select("id,expires_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new Error("integrity_observation_duplicate_step");
    throw new Error("integrity_observation_store_failed");
  }

  return {
    id: String(data.id),
    envelope,
    envelope_hash: envelopeHash,
    state_snapshot,
    state_hash: stateHash,
    expires_at: String(data.expires_at),
  };
}
