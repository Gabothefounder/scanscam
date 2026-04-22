import type { AbuseInterpretationV1 } from "@/lib/scan-analysis/abuseInterpretation";
import type { LinkArtifact } from "@/lib/scan-analysis/extractLinkArtifacts";

export const ENABLE_ARCHETYPE_OVERRIDES = process.env.ENABLE_ARCHETYPE_OVERRIDES === "true";

export type ArchetypeOverrideContext = {
  context_quality: string;
  intel_state: string;
  input_type?: string;
  context_refined?: boolean;
};

export type ArchetypeOverrideHints = {
  abuse_interpretation?: AbuseInterpretationV1 | null;
  link_artifact?: LinkArtifact | null;
  link_present?: boolean;
};

export type ApplyArchetypeOverridesInput = {
  intel: Record<string, unknown>;
  corpusLower: string;
  context: ArchetypeOverrideContext;
  hints?: ArchetypeOverrideHints;
  mode?: "apply" | "shadow";
};

export type ApplyArchetypeOverridesOutput = {
  intel: Record<string, unknown>;
  applied: boolean;
  reason:
    | "flag_off"
    | "kill_context_quality"
    | "kill_insufficient_context"
    | "kill_link_only_unrefined"
    | "kill_meta_discussion"
    | "blocked_by_exclusion"
    | "no_match"
    | "applied";
  meta?: {
    archetype: "government_penalty" | "delivery_customs" | "interac_transfer" | "job_telegram_funnel";
    score: number;
    strongCueCount: number;
    coercionCue: boolean;
    matched: string[];
    blockedByExclusion: boolean;
    changedFields: string[];
  };
  overrideMeta?: OverrideMetaV1;
};

export type OverrideMetaV1 = {
  override_applied: true;
  override_version: "v1";
  override_rule_id: ArchetypeId;
  override_score: number;
  override_cues: string[];
  override_fields_changed: string[];
  override_before_snapshot: Record<string, unknown>;
  override_after_snapshot: Record<string, unknown>;
  override_timestamp: string;
  override_flag_state: boolean;
  override_reverted?: boolean;
  override_reverted_reason?: string;
  override_reverted_fields?: string[];
};

/**
 * Phase 2 deterministic archetype overrides.
 * Conservative by design:
 * - hard kills for weak context
 * - meta-discussion kill switch
 * - explicit thresholds + cue requirements
 * - only safe field transitions
 */
export function applyArchetypeOverrides(
  input: ApplyArchetypeOverridesInput
): ApplyArchetypeOverridesOutput {
  const runMode = input.mode ?? "apply";
  const canRun = ENABLE_ARCHETYPE_OVERRIDES || runMode === "shadow";
  if (!canRun) {
    return { intel: input.intel, applied: false, reason: "flag_off" };
  }

  const contextQuality = String(input.context.context_quality ?? "unknown");
  if (contextQuality === "fragment" || contextQuality === "unknown") {
    return { intel: input.intel, applied: false, reason: "kill_context_quality" };
  }

  if (String(input.context.intel_state ?? "unknown") === "insufficient_context") {
    return { intel: input.intel, applied: false, reason: "kill_insufficient_context" };
  }

  const inputType = String(input.context.input_type ?? "unknown");
  const refined = input.context.context_refined === true;
  if (inputType === "link_only" && !refined) {
    return { intel: input.intel, applied: false, reason: "kill_link_only_unrefined" };
  }

  if (isMetaDiscussion(input.corpusLower) && !hasStrongScamCueForMetaBypass(input.corpusLower)) {
    return { intel: input.intel, applied: false, reason: "kill_meta_discussion" };
  }

  const baseIntel = input.intel;
  const scoredCandidates = [
    scoreGovernmentPenalty(input.corpusLower),
    scoreDeliveryCustoms(input.corpusLower),
    scoreInteracTransfer(input.corpusLower),
    scoreJobTelegramFunnel(input.corpusLower),
  ];
  const topCandidate = [...scoredCandidates].sort((a, b) => b.score - a.score)[0];
  const candidates = scoredCandidates.filter((c) => c.eligible);

  if (candidates.length === 0) {
    const blockedByExclusion = Boolean(topCandidate?.blockedByExclusion);
    return {
      intel: input.intel,
      applied: false,
      reason: blockedByExclusion ? "blocked_by_exclusion" : "no_match",
      meta: topCandidate
        ? {
            archetype: topCandidate.id,
            score: topCandidate.score,
            strongCueCount: topCandidate.strongCueCount,
            coercionCue: topCandidate.coercionCue,
            matched: topCandidate.matched,
            blockedByExclusion: topCandidate.blockedByExclusion,
            changedFields: [],
          }
        : undefined,
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  const nextIntel = { ...baseIntel };
  const changedFields = applyArchetypeFieldPlan(nextIntel, winner.plan, {
    contextQuality,
    refined,
    hasCoercionCue: winner.coercionCue,
    scoreMet: winner.score >= winner.threshold,
  });

  if (changedFields.length === 0) {
    return {
      intel: input.intel,
      applied: false,
      reason: "no_match",
      meta: {
        archetype: winner.id,
        score: winner.score,
        strongCueCount: winner.strongCueCount,
        coercionCue: winner.coercionCue,
        matched: winner.matched,
        blockedByExclusion: winner.blockedByExclusion,
        changedFields: [],
      },
    };
  }

  const beforeSnapshot = buildFieldSnapshot(baseIntel, changedFields);
  const afterSnapshot = buildFieldSnapshot(nextIntel, changedFields);
  const overrideMeta: OverrideMetaV1 = {
    override_applied: true,
    override_version: "v1",
    override_rule_id: winner.id,
    override_score: winner.score,
    override_cues: winner.matched,
    override_fields_changed: changedFields,
    override_before_snapshot: beforeSnapshot,
    override_after_snapshot: afterSnapshot,
    override_timestamp: new Date().toISOString(),
    override_flag_state: ENABLE_ARCHETYPE_OVERRIDES && runMode === "apply",
  };

  return {
    intel: nextIntel,
    applied: true,
    reason: "applied",
    meta: {
      archetype: winner.id,
      score: winner.score,
      strongCueCount: winner.strongCueCount,
      coercionCue: winner.coercionCue,
      matched: winner.matched,
      blockedByExclusion: winner.blockedByExclusion,
      changedFields,
    },
    overrideMeta,
  };
}

type ArchetypeId = "government_penalty" | "delivery_customs" | "interac_transfer" | "job_telegram_funnel";

type ScoredArchetype = {
  id: ArchetypeId;
  score: number;
  strongCueCount: number;
  coercionCue: boolean;
  blockedByExclusion: boolean;
  matched: string[];
  threshold: number;
  eligible: boolean;
  plan: Partial<Record<AllowedField, string>>;
};

type AllowedField =
  | "narrative_category"
  | "narrative_family"
  | "authority_type"
  | "requested_action"
  | "payment_intent"
  | "threat_stage"
  | "intel_state";

const META_DISCUSSION = [
  /\bi got (?:this|a) scam message\b/i,
  /\bis this (?:fake|legit|a scam)\b/i,
  /\bcan you check this\b/i,
  /\bdoes this look suspicious\b/i,
  /\bis this suspicious\b/i,
  /\blooks like a scam\b/i,
];

const ACTION_CUES = [
  /\bpay\b/i,
  /\bclick\b/i,
  /\bverify\b/i,
  /\blog\s*in\b/i,
  /\bsign\s*in\b/i,
  /\baccept\b/i,
  /\btransfer\b/i,
  /\bdeposit\b/i,
  /\brequest\b/i,
];

const THREAT_CUES = [
  /\burgent\b/i,
  /\bimmediately\b/i,
  /\bdeadline\b/i,
  /\bwithin\s+\d+\s*(hour|hours|day|days)\b/i,
  /\bsuspend(?:ed|sion)?\b/i,
  /\bblocked\b/i,
  /\bpenalt(?:y|ies)\b/i,
  /\bplate\s+denial\b/i,
];

const PAYMENT_CUES = [
  /\bpayment\s+request\b/i,
  /\bpay(?:ment)?\s+(?:now|today)\b/i,
  /\bfee\b/i,
  /\bfine\b/i,
  /\bdeposit\s+pending\b/i,
  /\be-?transfer\b/i,
];

const BENIGN_REPAYMENT = [
  /\bsplit\s+bill\b/i,
  /\breimburse\b/i,
  /\bpaid\s+you\s+back\b/i,
  /\bdinner\b/i,
  /\brent\s+split\b/i,
  /\bfriends?\s+payment\b/i,
];

function hasAny(text: string, rules: RegExp[]): boolean {
  return rules.some((r) => r.test(text));
}

function countMatches(text: string, groups: { id: string; re: RegExp }[]): { count: number; ids: string[] } {
  const ids = groups.filter((g) => g.re.test(text)).map((g) => g.id);
  return { count: ids.length, ids };
}

function isMetaDiscussion(text: string): boolean {
  return hasAny(text, META_DISCUSSION);
}

function hasStrongScamCueForMetaBypass(text: string): boolean {
  const coercion = /\bpay\b|\bclick\b|\bverify\b|\bsend\b/i.test(text);
  const threat = /\bblocked\b|\bsuspend(?:ed|sion)?\b|\bdenied\b|\bplate\s+denial\b/i.test(text);
  const payment = /\bpayment\s+request\b|\bfee\b|\bfine\b|\bdeposit\b|\be-?\s*transfer\b/i.test(text);
  return coercion || threat || payment;
}

function hasExplicitCoercionOrAction(text: string): boolean {
  return hasAny(text, [...ACTION_CUES, ...THREAT_CUES, ...PAYMENT_CUES]);
}

function isUnknownLike(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "" || s === "unknown";
}

function isNoneLike(v: unknown): boolean {
  return typeof v === "string" && v.trim().toLowerCase() === "none";
}

function canUpgradeNone(contextQuality: string, refined: boolean, hasCoercionCue: boolean, scoreMet: boolean): boolean {
  const atLeastPartial = contextQuality === "partial" || contextQuality === "full" || (refined && contextQuality === "thin");
  return atLeastPartial && hasCoercionCue && scoreMet;
}

function isSameFamilyStrengthening(field: AllowedField, current: unknown, next: string): boolean {
  if (typeof current !== "string") return false;
  const cur = current.trim().toLowerCase();
  const nxt = next.trim().toLowerCase();
  if (!cur || !nxt) return false;
  if (field === "narrative_category" || field === "narrative_family") {
    return cur === nxt;
  }
  if (field === "authority_type") {
    return cur === nxt;
  }
  return false;
}

function setFieldConservative(
  intel: Record<string, unknown>,
  field: AllowedField,
  value: string,
  opts: {
    contextQuality: string;
    refined: boolean;
    hasCoercionCue: boolean;
    scoreMet: boolean;
  }
): boolean {
  const current = intel[field];
  if (typeof current === "string" && current.trim().toLowerCase() === value.trim().toLowerCase()) {
    return false;
  }

  if (isUnknownLike(current)) {
    intel[field] = value;
    return true;
  }

  if (isNoneLike(current)) {
    if (!canUpgradeNone(opts.contextQuality, opts.refined, opts.hasCoercionCue, opts.scoreMet)) return false;
    intel[field] = value;
    return true;
  }

  if (isSameFamilyStrengthening(field, current, value) && opts.scoreMet) {
    intel[field] = value;
    return true;
  }

  return false;
}

function applyArchetypeFieldPlan(
  intel: Record<string, unknown>,
  plan: Partial<Record<AllowedField, string>>,
  opts: { contextQuality: string; refined: boolean; hasCoercionCue: boolean; scoreMet: boolean }
): string[] {
  const changed: string[] = [];
  const ordered: AllowedField[] = [
    "narrative_category",
    "narrative_family",
    "authority_type",
    "requested_action",
    "payment_intent",
    "threat_stage",
    "intel_state",
  ];
  for (const field of ordered) {
    const v = plan[field];
    if (!v) continue;
    if (setFieldConservative(intel, field, v, opts)) changed.push(field);
  }
  return changed;
}

function buildFieldSnapshot(intel: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    out[f] = intel[f];
  }
  return out;
}

function scoreGovernmentPenalty(text: string): ScoredArchetype {
  const strong = [
    { id: "gov_entity_mto", re: /\bmto\b/i },
    { id: "gov_entity_service_ontario", re: /\bservice\s*ontario\b|\bserviceontario\b/i },
    { id: "gov_penalty", re: /\bparking\s+(violation|ticket|fine|notice)\b|\bcontraventions?\b|\bamendes?\b/i },
    { id: "gov_restriction", re: /\bplate\s+denial\b|permit\s+renewal\s+blocked|refus\s+de\s+la\s+plaque/i },
    { id: "gov_payment_request", re: /\bpay\b.*\b(fine|fee|penalty)\b|\bpenalty\b.*\bpay\b/i },
  ];
  const soft = [
    { id: "gov_notice", re: /\bofficial\s+notice\b|\bavis\s+officiel\b/i },
    { id: "gov_ticket_generic", re: /\bticket\b|\bpermit\b|\brenewal\b/i },
    { id: "gov_weak_urgency", re: /\bsoon\b|\basap\b/i },
  ];
  const negative = [
    { id: "gov_policy_info", re: /\bpolicy\b|\bhow\s+to\b|\bguide\b|\bnews\b/i },
    { id: "gov_civic_reminder", re: /\breminder\b.*\brenew\b/i },
    { id: "gov_meta", re: /\bis this fake\b|\bscam message\b/i },
  ];

  const strongM = countMatches(text, strong);
  const softM = countMatches(text, soft);
  const negM = countMatches(text, negative);
  const coercionCue = hasExplicitCoercionOrAction(text);
  const govInfoContext = /\bpolicy\b|\bhow\s+to\b|\bguide\b|\bnews\b/i.test(text);
  const hardBlocked = govInfoContext && !coercionCue;
  const score = strongM.count * 2 + softM.count - negM.count * 2;
  const blockedByExclusion = hardBlocked || (negM.count > 0 && strongM.count < 3);
  const eligible = !blockedByExclusion && coercionCue && strongM.count >= 2 && score >= 5;
  const hasPayment = /\bpay\b|\bfee\b|\bfine\b|\bpenalty\b/i.test(text);

  const plan: Partial<Record<AllowedField, string>> = {
    narrative_category: "government_impersonation",
    narrative_family: "government_impersonation",
    intel_state: "structured_signal",
    threat_stage: "payment_extraction",
  };
  if (hasPayment) {
    plan.payment_intent = "fee_or_debt_pressure";
    plan.requested_action = "pay_money";
  }
  if ((/\bmto\b|\bservice\s*ontario\b|\bserviceontario\b/i.test(text) || /\bgovernment\b/i.test(text)) && coercionCue) {
    plan.authority_type = "government";
  }

  return {
    id: "government_penalty",
    score,
    strongCueCount: strongM.count,
    coercionCue,
    blockedByExclusion,
    matched: [...strongM.ids, ...softM.ids, ...negM.ids.map((n) => `neg:${n}`)],
    threshold: 5,
    eligible,
    plan,
  };
}

function scoreDeliveryCustoms(text: string): ScoredArchetype {
  const strong = [
    { id: "deliv_brand", re: /\bdhl\b|\bpurolator\b|\bcanada\s+post\b|\bpostes\s+canada\b/i },
    { id: "deliv_hold", re: /\bpackage\b.*\bhold\b|\bparcel\b.*\bhold\b|\bredelivery\b/i },
    { id: "deliv_customs_fee", re: /\bcustoms\b.*\bfee\b|\bpay\b.*\bcustoms\b/i },
    { id: "deliv_action", re: /\bclick\b.*\blink\b|\bverify\b.*\bdelivery\b|\bpay\b.*\bdelivery\b/i },
  ];
  const soft = [
    { id: "deliv_generic", re: /\bpackage\b|\bdelivery\b|\btracking\b|\bcourier\b/i },
    { id: "deliv_channel_hint", re: /\bsms\b|\btext\b/i },
    { id: "deliv_weak_urgency", re: /\bsoon\b|\basap\b/i },
  ];
  const negative = [
    { id: "deliv_order_confirmation", re: /\border\s+confirm(?:ed|ation)\b/i },
    { id: "deliv_tracking_only", re: /\bout\s+for\s+delivery\b|\btrack\s+your\s+package\b/i },
    { id: "deliv_shipping_update", re: /\bshipping\s+update\b/i },
  ];

  const strongM = countMatches(text, strong);
  const softM = countMatches(text, soft);
  const negM = countMatches(text, negative);
  const coercionCue = hasExplicitCoercionOrAction(text);
  const deliveryBenignContext =
    /\border\s+confirm(?:ed|ation)\b|\bshipping\s+update\b|\btrack\s+your\s+package\b/i.test(text);
  const deliveryThreatOrPayment = /\bpay\b|\bfee\b|\burgent\b|\bblocked\b|\bcustoms\b/i.test(text);
  const hardBlocked = deliveryBenignContext && !deliveryThreatOrPayment;
  const score = strongM.count * 2 + softM.count - negM.count * 2;
  const blockedByExclusion = hardBlocked || (negM.count > 0 && !/\bpay\b|\bfee\b|\burgent\b|\bblocked\b/i.test(text));
  const eligible = !blockedByExclusion && coercionCue && strongM.count >= 2 && score >= 5;
  const hasPayment = /\bpay\b|\bfee\b|\bcustoms\b/i.test(text);

  const plan: Partial<Record<AllowedField, string>> = {
    narrative_category: "delivery_scam",
    narrative_family: "delivery_scam",
    intel_state: "structured_signal",
  };
  if (coercionCue) {
    plan.requested_action = hasPayment ? "pay_money" : "click_link";
  }
  if (hasPayment) {
    plan.payment_intent = "fee_or_debt_pressure";
    plan.threat_stage = "payment_extraction";
  }
  return {
    id: "delivery_customs",
    score,
    strongCueCount: strongM.count,
    coercionCue,
    blockedByExclusion,
    matched: [...strongM.ids, ...softM.ids, ...negM.ids.map((n) => `neg:${n}`)],
    threshold: 5,
    eligible,
    plan,
  };
}

function scoreInteracTransfer(text: string): ScoredArchetype {
  const strong = [
    { id: "interac_entity", re: /\binterac\b|\be-?\s*transfer\b/i },
    { id: "interac_pending_deposit", re: /\bpending\s+deposit\b/i },
    { id: "interac_accept_deposit", re: /\baccept\s+deposit\b/i },
    { id: "interac_deposit_waiting", re: /\bdeposit\s+waiting\b|\bmoney\s+waiting\b/i },
    { id: "interac_claim_transfer", re: /\bclaim\s+transfer\b/i },
    { id: "interac_security_hold", re: /\bsecurity\s+hold\b/i },
    { id: "interac_payment_action", re: /\bpay\b|\bsend\s+money\b/i },
  ];
  const soft = [
    { id: "interac_bank_context", re: /\bbank\b|\baccount\b|\bfinancial\b/i },
    { id: "interac_alert", re: /\balert\b|\bnotification\b/i },
    { id: "interac_weak_urgency", re: /\bsoon\b|\basap\b/i },
  ];
  const negative = [
    { id: "interac_split_bill", re: /\bsplit\s+bill\b|\bdinner\b|\brent\s+split\b/i },
    { id: "interac_reimburse", re: /\breimburse\b|\bpaid\s+you\s+back\b/i },
    { id: "interac_benign_chat", re: /\bthanks\b.*\btransfer\b/i },
  ];

  const strongM = countMatches(text, strong);
  const softM = countMatches(text, soft);
  const negM = countMatches(text, negative);
  const coercionCue = hasExplicitCoercionOrAction(text);
  const score = strongM.count * 2 + softM.count - negM.count * 2;
  const hasInteracEntity = /\binterac\b|\be-?\s*transfer\b/i.test(text);
  const hasInteracRequiredCompanion =
    /\bpending\s+deposit\b|\baccept\s+deposit\b|\bdeposit\s+waiting\b|\bmoney\s+waiting\b|\bclaim\s+transfer\b|\bsecurity\s+hold\b/i.test(
      text
    ) || /\bpay\b|\bsend\s+money\b/i.test(text);
  const mandatoryInteracSatisfied = hasInteracEntity && hasInteracRequiredCompanion;
  const blockedByExclusion = negM.count > 0;
  const eligible =
    mandatoryInteracSatisfied && !blockedByExclusion && coercionCue && strongM.count >= 2 && score >= 5;
  const explicitPayment = /\bpayment\s+request\b|\bpay\b|\bsend\s+money\b|\bdeposit\b|\baccept\b/i.test(text);

  const plan: Partial<Record<AllowedField, string>> = {
    narrative_category: "financial_phishing",
    intel_state: "structured_signal",
  };
  if (explicitPayment) {
    plan.payment_intent = "direct_payment_request";
    plan.requested_action = "pay_money";
    plan.threat_stage = "payment_extraction";
  }
  if (hasInteracEntity && coercionCue) {
    plan.authority_type = "financial_institution";
  }

  return {
    id: "interac_transfer",
    score,
    strongCueCount: strongM.count,
    coercionCue,
    blockedByExclusion,
    matched: [
      ...strongM.ids,
      ...softM.ids,
      ...negM.ids.map((n) => `neg:${n}`),
      `mandatoryInterac:${mandatoryInteracSatisfied ? "yes" : "no"}`,
    ],
    threshold: 5,
    eligible,
    plan,
  };
}

function scoreJobTelegramFunnel(text: string): ScoredArchetype {
  const strong = [
    { id: "job_entity", re: /\bjob\b|\brecruiter\b|\bhiring\b|\bwork\s+from\s+home\b|\bemploi\b/i },
    { id: "job_offplatform", re: /\btelegram\b|\bwhatsapp\b|\bmove\s+to\s+telegram\b|\bcontact\s+on\s+telegram\b/i },
    { id: "job_payment_setup", re: /\bpayroll\b.*\bsetup\b|\btrial\s+payment\b|\btraining\s+deposit\b/i },
    { id: "job_payment_action", re: /\bdeposit\b|\bpay\b|\btransfer\b|\bsend\s+money\b/i },
  ];
  const soft = [
    { id: "job_onboarding", re: /\bonboarding\b|\btask\b|\btrial\b/i },
    { id: "job_channel_hint", re: /\bchat\b|\bmessage\s+me\b/i },
    { id: "job_weak_urgency", re: /\bquickly\b|\basap\b/i },
  ];
  const negative = [
    { id: "job_legit_outreach", re: /\binterview\s+next\s+week\b|\bjob\s+board\b|\bapplication\s+received\b/i },
    { id: "job_schedule_only", re: /\bschedule\b.*\binterview\b/i },
    { id: "job_generic_posting", re: /\bposition\s+available\b.*\bapply\b/i },
  ];

  const strongM = countMatches(text, strong);
  const softM = countMatches(text, soft);
  const negM = countMatches(text, negative);
  const coercionCue = hasExplicitCoercionOrAction(text);
  const score = strongM.count * 2 + softM.count - negM.count * 2;
  const hasFunnel = /\btelegram\b|\bwhatsapp\b|\btrial\s+payment\b|\btraining\s+deposit\b|\bpayroll\b/i.test(text);
  const jobBenignContext =
    /\binterview\s+scheduled\b|\bapplication\s+received\b|\bjob\s+board\b/i.test(text);
  const jobRiskFunnelOrPayment =
    /\btelegram\b|\bwhatsapp\b|\btrial\s+payment\b|\btraining\s+deposit\b|\bpayroll\b|\bdeposit\b|\bpay\b|\bsend\s+money\b/i.test(
      text
    );
  const hardBlocked = jobBenignContext && !jobRiskFunnelOrPayment;
  const blockedByExclusion = hardBlocked || (negM.count > 0 && !hasFunnel);
  const eligible = !blockedByExclusion && hasFunnel && coercionCue && strongM.count >= 2 && score >= 6;
  const explicitPayment = /\bdeposit\b|\bpay\b|\btransfer\b|\bsend\s+money\b|\bpayment\b/i.test(text);

  const plan: Partial<Record<AllowedField, string>> = {
    narrative_category: "employment_scam",
    narrative_family: "employment_scam",
    intel_state: "structured_signal",
    threat_stage: explicitPayment ? "payment_extraction" : "initial_lure",
  };
  if (explicitPayment) {
    plan.payment_intent = "direct_payment_request";
    plan.requested_action = "pay_money";
  } else {
    plan.requested_action = "click_link";
  }

  return {
    id: "job_telegram_funnel",
    score,
    strongCueCount: strongM.count,
    coercionCue,
    blockedByExclusion,
    matched: [...strongM.ids, ...softM.ids, ...negM.ids.map((n) => `neg:${n}`)],
    threshold: 6,
    eligible,
    plan,
  };
}
