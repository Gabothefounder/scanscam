/**
 * Summary generator. Cautious, trust-safe language only.
 * Never use: safe, guaranteed, criminal, scammer
 */

export type ExplainInput = {
  submissionRoute: string;
  narrativeFamily: string;
  impersonationEntity: string;
  requestedAction: string;
  threatStage: string;
  confidenceLevel: string;
  contextQuality?: string;
};

const ENTITY_LABELS: Record<string, string> = {
  cra: "CRA",
  service_canada: "Service Canada",
  rcmp: "RCMP",
  canada_post: "Canada Post",
  wealthsimple: "Wealthsimple",
  generic_government: "a government agency",
  generic_financial: "a financial institution",
  generic_courier: "a courier or delivery service",
};

const ACTION_PHRASES: Record<string, string> = {
  click_link: "click a link",
  call_number: "call a number",
  submit_credentials: "provide credentials or verify your identity",
  pay_money: "send money or make a payment",
  reply_sms: "reply to the message",
  download_app: "download an app",
};

const NARRATIVE_PHRASES: Record<string, string> = {
  delivery_scam: "a delivery or parcel message",
  government_impersonation: "a government or tax message",
  law_enforcement: "a law enforcement message",
  account_verification: "an account verification request",
  employment_scam: "an employment or job offer",
  recovery_scam: "a funds recovery offer",
  reward_claim: "a prize or reward claim",
  social_engineering_opener: "a social or contact opener",
  investment_fraud: "an investment offer",
};

function getEntityLabel(e: string): string | null {
  return (e && ENTITY_LABELS[e]) || null;
}

function getActionPhrase(a: string): string | null {
  return (a && a !== "none" && a !== "unknown" && ACTION_PHRASES[a]) || null;
}

function getNarrativePhrase(n: string): string | null {
  return (n && n !== "unknown" && NARRATIVE_PHRASES[n]) || null;
}

function isInsufficientContext(route: string, ctx: string | undefined): boolean {
  return route === "insufficient_context" || ctx === "fragment";
}

const MAX_LENGTH = 200;

export function explain(input: ExplainInput): string {
  const {
    submissionRoute,
    narrativeFamily,
    impersonationEntity,
    requestedAction,
    confidenceLevel,
    contextQuality,
  } = input;

  // insufficient_context: always use cautious fallback
  if (isInsufficientContext(submissionRoute, contextQuality)) {
    return "Not enough context is available to classify this reliably. Proceed with caution.";
  }

  // likely_scam + thin: use fraud-pattern message instead of generic limited-context
  if (submissionRoute === "likely_scam" && contextQuality === "thin") {
    return "This message shows patterns commonly associated with fraud attempts. Proceed with caution.";
  }

  // low confidence with thin context
  if (confidenceLevel === "low" && (contextQuality === "thin" || !contextQuality)) {
    return "This message has limited context. Proceed with caution and verify through official channels.";
  }

  const entity = getEntityLabel(impersonationEntity);
  const action = getActionPhrase(requestedAction);
  const narrative = getNarrativePhrase(narrativeFamily);

  const parts: string[] = [];

  if (entity && (narrative || action)) {
    parts.push(`This appears to impersonate ${entity}`);
    if (action) {
      parts.push(`and asks you to ${action}`);
    }
    parts.push(".");
  } else if (narrative && action) {
    parts.push(`This may indicate ${narrative}.`);
    parts.push(`It asks you to ${action}.`);
  } else if (narrative) {
    parts.push(`This may indicate ${narrative}.`);
    if (action) {
      parts.push(`It asks you to ${action}.`);
    }
  } else if (entity) {
    parts.push(`This appears to impersonate ${entity}.`);
    if (action) {
      parts.push(`It asks you to ${action}.`);
    }
  } else if (action) {
    parts.push(`This message asks you to ${action}.`);
  } else if (submissionRoute === "likely_scam") {
    parts.push("This message shows patterns commonly associated with fraud attempts. Proceed with caution.");
  } else if (submissionRoute === "ambiguous") {
    parts.push("This message could not be clearly classified. Verify through official channels if unsure.");
  } else {
    parts.push("Proceed with caution. Verify through official channels if the message seems unexpected.");
  }

  let summary = parts.join(" ").replace(/\s+/g, " ").trim();
  if (summary.length > MAX_LENGTH) {
    summary = summary.slice(0, MAX_LENGTH - 3).trim() + "...";
  }
  return summary || "Proceed with caution. Verify through official channels if unsure.";
}
