import type { SemanticExtraction } from "@/lib/ai/semanticSchema";

type Intel = Record<string, unknown>;

function missing(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v === "" || v === "unknown" || v === "none" || v === "unclear";
}

const ACTION_MAP: Record<string, string> = {
  click_link: "click_link",
  call_number: "call_number",
  submit_credentials: "submit_credentials",
  pay_money: "pay_money",
  reply: "reply_sms",
  download_app: "download_app",
};

const STAGE_MAP: Record<string, string> = {
  initial_contact: "initial_lure",
  lure: "initial_lure",
  credential_capture: "credential_capture",
  payment_extraction: "payment_extraction",
  recovery: "post_loss_recovery",
};

const AUTHORITY_MAP: Record<string, string> = {
  government: "government",
  financial_institution: "financial_institution",
  courier: "delivery_service",
  employer: "employer",
  law_enforcement: "law_enforcement",
  platform: "platform",
};

export function applySemanticSensor(
  intel: Intel,
  semantic: SemanticExtraction | undefined,
  meta: { model: string; analysisPath: string }
): Intel {
  const out = { ...intel };
  out.analysis_model = meta.model;
  out.analysis_path = meta.analysisPath;
  out.semantic_sensor_version = "v1";

  if (!semantic) return out;

  // Store normalized semantic output only. Never persist semantic evidence excerpts here.
  out.semantic_v1 = {
    context_sufficiency: semantic.context_sufficiency,
    claimed_identity_type: semantic.claimed_identity_type,
    scam_family: semantic.scam_family,
    requested_actions: semantic.requested_actions,
    requested_assets: semantic.requested_assets,
    tactics: semantic.tactics.map((t) => ({
      type: t.type,
      confidence: t.confidence,
    })),
    attack_stage: semantic.attack_stage,
    confidence: semantic.confidence,
  };

  if (missing(out.narrative_family) && semantic.scam_family !== "unknown") {
    out.narrative_family = semantic.scam_family;
  }

  if (missing(out.requested_action)) {
    const mapped = semantic.requested_actions.map((a) => ACTION_MAP[a]).find(Boolean);
    if (mapped) out.requested_action = mapped;
  }

  if (missing(out.threat_stage)) {
    const mapped = STAGE_MAP[semantic.attack_stage];
    if (mapped) out.threat_stage = mapped;
  }

  if (missing(out.authority_type)) {
    const mapped = AUTHORITY_MAP[semantic.claimed_identity_type];
    if (mapped) out.authority_type = mapped;
  }

  if (missing(out.confidence_level)) {
    out.confidence_level =
      semantic.confidence >= 0.85 ? "high" :
      semantic.confidence >= 0.55 ? "medium" :
      "low";
  }

  out.requested_assets = semantic.requested_assets.filter((x) => x !== "unknown");
  out.semantic_tactics = semantic.tactics
    .filter((t) => t.confidence >= 0.45)
    .map((t) => t.type);

  out.verification_suppression =
    semantic.tactics.some((t) => t.type === "verification_suppression" && t.confidence >= 0.55);
  out.channel_migration =
    semantic.tactics.some((t) => t.type === "channel_migration" && t.confidence >= 0.55) ||
    semantic.requested_actions.includes("move_channel");

  return out;
}
