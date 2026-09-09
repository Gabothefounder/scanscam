import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  emptyHumanValueProfile,
  valueProfileHashes,
  type HumanValueProfile,
} from "./value-profile";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export type StoredValueProfile = {
  id: string;
  principal_id: string;
  version: number;
  status: "draft" | "active" | "archived";
  profile: HumanValueProfile;
  compiled_mandate: Record<string, unknown>;
  question_count: number;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
};

export async function createValueProfileDraft(): Promise<StoredValueProfile> {
  const id = crypto.randomUUID();
  const principalId = `value-guard-preview:${id}`;
  const profile = emptyHumanValueProfile();
  const hashes = valueProfileHashes(profile);

  const { data, error } = await supabase
    .from("integrity_value_profiles")
    .insert({
      id,
      principal_id: principalId,
      version: 1,
      status: "draft",
      profile,
      profile_hash: hashes.profile_hash,
      compiled_mandate: hashes.compiled_mandate,
      compiled_mandate_hash: hashes.compiled_mandate_hash,
      question_count: 0,
      metadata: {
        environment: "preview",
        raw_answers_persisted: false,
      },
    })
    .select("id,principal_id,version,status,profile,compiled_mandate,question_count,created_at,updated_at,activated_at")
    .single();

  if (error || !data) throw new Error("value_profile_create_failed");

  await supabase.from("integrity_value_events").insert({
    profile_id: id,
    principal_id: principalId,
    event_type: "profile_created",
    structured_summary: {
      version: "0.6",
      raw_answers_persisted: false,
    },
  });

  return data as StoredValueProfile;
}

export async function getValueProfile(profileId: string): Promise<StoredValueProfile> {
  const { data, error } = await supabase
    .from("integrity_value_profiles")
    .select("id,principal_id,version,status,profile,compiled_mandate,question_count,created_at,updated_at,activated_at")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error("value_profile_lookup_failed");
  if (!data) throw new Error("value_profile_not_found");
  return data as StoredValueProfile;
}

export async function saveValueProfile(input: {
  profile_id: string;
  profile: HumanValueProfile;
  event_summary?: string[];
  event_type?: "answer_compiled" | "profile_edited" | "decision_feedback";
}): Promise<StoredValueProfile> {
  const existing = await getValueProfile(input.profile_id);
  const hashes = valueProfileHashes(input.profile);
  const nextQuestionCount =
    input.event_type === "answer_compiled"
      ? existing.question_count + 1
      : existing.question_count;

  const { data, error } = await supabase
    .from("integrity_value_profiles")
    .update({
      profile: input.profile,
      profile_hash: hashes.profile_hash,
      compiled_mandate: hashes.compiled_mandate,
      compiled_mandate_hash: hashes.compiled_mandate_hash,
      question_count: nextQuestionCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.profile_id)
    .select("id,principal_id,version,status,profile,compiled_mandate,question_count,created_at,updated_at,activated_at")
    .single();

  if (error || !data) throw new Error("value_profile_save_failed");

  if (input.event_summary?.length) {
    await supabase.from("integrity_value_events").insert({
      profile_id: input.profile_id,
      principal_id: existing.principal_id,
      event_type: input.event_type ?? "profile_edited",
      structured_summary: {
        learned: input.event_summary.slice(0, 8),
      },
    });
  }

  return data as StoredValueProfile;
}

export async function activateValueProfile(profileId: string): Promise<{
  principal_id: string;
  profile_id: string;
  mandate_version: number;
  mandate_hash: string;
}> {
  const { data, error } = await supabase.rpc("activate_integrity_value_profile", {
    p_profile_id: profileId,
  });

  if (error) throw new Error("value_profile_activate_failed");
  const result = data as
    | {
        ok: true;
        principal_id: string;
        profile_id: string;
        mandate_version: number;
        mandate_hash: string;
      }
    | { ok: false; error: string }
    | null;

  if (!result) throw new Error("value_profile_activate_failed");
  if (!result.ok) throw new Error(result.error);

  return {
    principal_id: String(result.principal_id),
    profile_id: String(result.profile_id),
    mandate_version: Number(result.mandate_version),
    mandate_hash: String(result.mandate_hash),
  };
}
