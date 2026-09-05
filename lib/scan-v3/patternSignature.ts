import crypto from "node:crypto";

type Intel = Record<string, unknown>;

function norm(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const v = value.trim().toLowerCase();
  return v && v !== "none" ? v : "unknown";
}

function normList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x && x !== "unknown" && x !== "none")
  )].sort();
}

export type PatternSignatureV1 = {
  version: "v1";
  signature: string;
  family: string;
  channel: string;
  requested_action: string;
  authority: string;
  attack_stage: string;
  requested_assets: string[];
  tactics: string[];
};

export function buildPatternSignatureV1(intel: Intel): PatternSignatureV1 {
  const semantic =
    intel.semantic_v1 && typeof intel.semantic_v1 === "object"
      ? intel.semantic_v1 as Record<string, unknown>
      : {};

  const family = norm(intel.narrative_family ?? semantic.scam_family);
  const channel = norm(intel.channel_type);
  const requested_action = norm(intel.requested_action);
  const authority = norm(intel.authority_type ?? semantic.claimed_identity_type);
  const attack_stage = norm(semantic.attack_stage ?? intel.threat_stage);
  const requested_assets = normList(intel.requested_assets ?? semantic.requested_assets);
  const tactics = normList(intel.semantic_tactics);

  const canonical = JSON.stringify({
    v: 1,
    family,
    channel,
    requested_action,
    authority,
    attack_stage,
    requested_assets,
    tactics,
  });

  return {
    version: "v1",
    signature: crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32),
    family,
    channel,
    requested_action,
    authority,
    attack_stage,
    requested_assets,
    tactics,
  };
}
