/**
 * Hard AI fallback presentation (Phase 0 Priority 1).
 *
 * Separates analysis_status from risk_tier:
 * - usedFallback means the LLM result was unusable (parse/schema failure after retry).
 * - That is never evidence of low risk / "safe".
 * - Deterministic enrichment may still raise risk_tier to medium/high; preserve that caution.
 * - Schema/types may still carry a placeholder risk_tier from fallbackResult; user-facing
 *   and verdict decisions must gate on analysis_status === "unavailable".
 */

export type RiskTier = "low" | "medium" | "high";
export type AnalysisStatus = "ok" | "unavailable";
export type UserVerdict = "safe" | "suspicious" | "scam" | "uncertain";

export type HardFallbackPresentationInput = {
  usedFallback: boolean;
  riskTier: RiskTier;
  summarySentence: string | null;
  language: "en" | "fr" | "mixed";
};

export type HardFallbackPresentation = {
  analysis_status: AnalysisStatus;
  used_fallback: boolean;
  risk_tier: RiskTier;
  user_verdict: UserVerdict;
  summary_sentence: string | null;
};

function langOf(language: "en" | "fr" | "mixed"): "en" | "fr" {
  return language === "fr" ? "fr" : "en";
}

/** Primary copy when AI failed and there is no elevated deterministic caution. */
export function unavailableSummary(language: "en" | "fr" | "mixed"): string {
  return langOf(language) === "fr"
    ? "Impossible d’analyser ce message de façon fiable. En cas de doute, ne cliquez sur aucun lien et vérifiez par un canal officiel."
    : "We could not analyze this message reliably. If unsure, do not click links and verify through an official channel.";
}

/** Note appended when deterministic rules still raised medium/high. */
export function unavailableCautionNote(language: "en" | "fr" | "mixed"): string {
  return langOf(language) === "fr"
    ? "Analyse IA complète indisponible — cette alerte repose sur des contrôles automatiques du message."
    : "Full AI analysis was unavailable — this caution is based on automated checks of the message.";
}

function verdictFromTier(tier: RiskTier): UserVerdict {
  if (tier === "high") return "scam";
  if (tier === "medium") return "suspicious";
  return "safe";
}

/**
 * Apply hard-fallback gates. When usedFallback is false, behavior matches historical verdict mapping.
 * risk_tier is never rewritten to a fake classification solely to represent failure.
 */
export function applyHardFallbackPresentation(
  input: HardFallbackPresentationInput
): HardFallbackPresentation {
  const { usedFallback, riskTier, summarySentence, language } = input;

  if (!usedFallback) {
    return {
      analysis_status: "ok",
      used_fallback: false,
      risk_tier: riskTier,
      user_verdict: verdictFromTier(riskTier),
      summary_sentence: summarySentence,
    };
  }

  const elevated = riskTier === "medium" || riskTier === "high";
  let summary: string;
  if (!elevated) {
    summary = unavailableSummary(language);
  } else {
    const base = (summarySentence ?? "").trim();
    const note = unavailableCautionNote(language);
    summary = base.length > 0 ? `${base} ${note}` : `${unavailableSummary(language)} ${note}`;
  }

  return {
    analysis_status: "unavailable",
    used_fallback: true,
    risk_tier: riskTier,
    user_verdict: "uncertain",
    summary_sentence: summary,
  };
}

/** Regression checks for Priority 1 invariants. */
export function verifyHardFallbackPresentation(): void {
  const weak = applyHardFallbackPresentation({
    usedFallback: true,
    riskTier: "low",
    summarySentence: "This message doesn’t look like a typical scam based on what we saw.",
    language: "en",
  });
  if (weak.analysis_status !== "unavailable") throw new Error("expected unavailable");
  if (weak.used_fallback !== true) throw new Error("expected used_fallback");
  if (weak.user_verdict === "safe") throw new Error("verdict must not be safe");
  if (weak.user_verdict !== "uncertain") throw new Error("expected uncertain verdict");
  if (weak.risk_tier !== "low") throw new Error("placeholder tier may remain low; status gates UI");
  if (/doesn.?t look like a typical scam/i.test(weak.summary_sentence ?? "")) {
    throw new Error("must not keep reassuring low summary");
  }
  if (!/could not analyze/i.test(weak.summary_sentence ?? "")) {
    throw new Error("expected unavailable summary");
  }

  const high = applyHardFallbackPresentation({
    usedFallback: true,
    riskTier: "high",
    summarySentence: "This message asks for payment with urgency.",
    language: "en",
  });
  if (high.analysis_status !== "unavailable") throw new Error("high: expected unavailable");
  if (high.risk_tier !== "high") throw new Error("high: must preserve caution tier");
  if (high.user_verdict === "safe") throw new Error("high: verdict must not be safe");
  if (high.user_verdict !== "uncertain") throw new Error("high: expected uncertain");
  if (!/Full AI analysis was unavailable/i.test(high.summary_sentence ?? "")) {
    throw new Error("high: expected unavailable caution note");
  }
  if (!/payment with urgency/i.test(high.summary_sentence ?? "")) {
    throw new Error("high: should keep deterministic caution summary");
  }

  const ok = applyHardFallbackPresentation({
    usedFallback: false,
    riskTier: "low",
    summarySentence: "Looks routine.",
    language: "en",
  });
  if (ok.analysis_status !== "ok") throw new Error("success path must stay ok");
  if (ok.user_verdict !== "safe") throw new Error("success low may still be safe");
  if (ok.used_fallback !== false) throw new Error("success used_fallback false");
}
