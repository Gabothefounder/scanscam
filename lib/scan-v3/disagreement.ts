import type { SemanticExtraction } from "@/lib/ai/semanticSchema";

export type DisagreementItemV1 = {
  dimension: "context" | "family" | "requested_action" | "stage";
  semantic: string;
  deterministic: string;
  weight: number;
};

export type DisagreementV1 = {
  version: "v1";
  score: number;
  count: number;
  items: DisagreementItemV1[];
  semantic_confidence: number | null;
};

function usable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v || ["unknown", "none", "unclear"].includes(v)) return null;
  return v;
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

function firstSemanticAction(semantic: SemanticExtraction): string | null {
  for (const action of semantic.requested_actions) {
    const mapped = ACTION_MAP[action];
    if (mapped) return mapped;
  }
  return null;
}

export function buildDisagreementV1(input: {
  semantic?: SemanticExtraction;
  deterministic: {
    contextQuality?: string;
    submissionRoute?: string;
    narrativeFamily?: string;
    requestedAction?: string;
    threatStage?: string;
  };
}): DisagreementV1 {
  const semantic = input.semantic;
  if (!semantic) {
    return { version: "v1", score: 0, count: 0, items: [], semantic_confidence: null };
  }

  const items: DisagreementItemV1[] = [];
  const deterministicInsufficient =
    input.deterministic.submissionRoute === "insufficient_context" ||
    ["fragment", "unknown"].includes(String(input.deterministic.contextQuality ?? ""));

  if (
    (semantic.context_sufficiency === "insufficient") !== deterministicInsufficient &&
    semantic.confidence >= 0.55
  ) {
    items.push({
      dimension: "context",
      semantic: semantic.context_sufficiency,
      deterministic: deterministicInsufficient ? "insufficient" : "enough",
      weight: 0.8,
    });
  }

  const semanticFamily = usable(semantic.scam_family);
  const deterministicFamily = usable(input.deterministic.narrativeFamily);
  if (
    semanticFamily &&
    deterministicFamily &&
    semanticFamily !== deterministicFamily &&
    semantic.confidence >= 0.55
  ) {
    items.push({
      dimension: "family",
      semantic: semanticFamily,
      deterministic: deterministicFamily,
      weight: 1,
    });
  }

  const semanticAction = firstSemanticAction(semantic);
  const deterministicAction = usable(input.deterministic.requestedAction);
  if (
    semanticAction &&
    deterministicAction &&
    semanticAction !== deterministicAction &&
    semantic.confidence >= 0.55
  ) {
    items.push({
      dimension: "requested_action",
      semantic: semanticAction,
      deterministic: deterministicAction,
      weight: 0.9,
    });
  }

  const semanticStage = STAGE_MAP[semantic.attack_stage] ?? usable(semantic.attack_stage);
  const deterministicStage = usable(input.deterministic.threatStage);
  if (
    semanticStage &&
    deterministicStage &&
    semanticStage !== deterministicStage &&
    semantic.confidence >= 0.65
  ) {
    items.push({
      dimension: "stage",
      semantic: semanticStage,
      deterministic: deterministicStage,
      weight: 0.6,
    });
  }

  const raw = items.reduce((sum, item) => sum + item.weight, 0);
  return {
    version: "v1",
    score: Math.min(1, Math.round((raw / 2.4) * 100) / 100),
    count: items.length,
    items,
    semantic_confidence: semantic.confidence,
  };
}
