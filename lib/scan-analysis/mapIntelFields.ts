/**
 * Deterministic fill pass for intel_features after harmonizeNarratives.
 *
 * Reduces avoidable unknowns from obvious message patterns only. Stays conservative:
 * no overrides of concrete values in Phase 1, skips fragment and insufficient-context routes,
 * no stacking with extortion-as-financial_phishing (extortion cues are not mapped here).
 */

import assert from "node:assert/strict";

export type IntelLike = Record<string, unknown>;

function isMissing(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return true;
  const s = value.trim();
  return s === "" || s === "unknown" || s === "none";
}

function maybeSet(intel: IntelLike, key: string, value: unknown): void {
  if (!isMissing(intel[key])) return;
  intel[key] = value;
}

/** Minimum trimmed length before any deterministic fill (avoids bare tokens / typos). */
const MIN_TEXT_LEN_FOR_MAPPING = 8;

/** Skip deterministic fills only for fragment inputs or explicit insufficient context. */
function shouldSkipMapping(intel: IntelLike): boolean {
  const q = String(intel.context_quality ?? "");
  if (q === "fragment") return true;
  const route = String(intel.submission_route ?? "");
  if (route === "insufficient_context") return true;
  const state = String(intel.intel_state ?? "");
  if (state === "insufficient_context") return true;
  return false;
}

// --- Rule detectors (text is lowercased raw message) ---

const GOV_FINE_MARKERS = [
  /\b(mto|service\s+ontario|serviceontario)\b/i,
  /\b(parking\s+violation|unpaid\s+parking|parking\s+ticket|parking\s+fine)\b/i,
  /\bcontraventions?\b/i,
  /\bstationnement\b/i,
  /billets?\s+impay(?:é|e)/i,
  /\bamendes?\b/i,
  /pénalités?|penalites?/i,
  /refus\s+de\s+(?:la\s+)?plaque/i,
  /renouvellement\s+du\s+permis/i,
  /\bplate\s+denial\b/i,
  /permit\s+renewal\s+blocked/i,
  /\bgovernment\s+fine\b/i,
];

function matchesGovernmentFine(text: string): boolean {
  const hits = GOV_FINE_MARKERS.filter((p) => p.test(text)).length;
  if (hits >= 2) return true;
  if (/\b(mto|service\s+ontario|contravention|parking\s+violation)\b/i.test(text)) return true;
  return false;
}

function matchesInteracTransfer(text: string): boolean {
  return (
    /\binterac\b/i.test(text) ||
    /\be-?\s*transfer\b/i.test(text) ||
    /\betransfer\b/i.test(text) ||
    /\baccept\s+(?:the\s+)?payment\s+request\b/i.test(text) ||
    /\btransfer\s+pending\b/i.test(text) ||
    /\bpending\s+transfer\b/i.test(text) ||
    /\binterac\s+e-?\s*transfer\s+deposit\b/i.test(text)
  );
}

function applyGovernmentFineFills(intel: IntelLike, text: string): void {
  maybeSet(intel, "narrative_category", "government_impersonation");
  maybeSet(intel, "narrative_family", "government_impersonation");
  maybeSet(intel, "authority_type", "government");
  maybeSet(intel, "payment_intent", "fee_or_debt_pressure");
  if (/\bpay\b|send\s+money|wire|etransfer|e-?\s*transfer|fine|fee\b|bitcoin\b/i.test(text)) {
    maybeSet(intel, "requested_action", "pay_money");
  }
}

function applyInteracFills(intel: IntelLike, text: string): void {
  maybeSet(intel, "narrative_category", "financial_phishing");
  maybeSet(intel, "authority_type", "financial_institution");
  maybeSet(intel, "payment_intent", "direct_payment_request");
  if (isMissing(intel.requested_action)) {
    intel.requested_action = /\bpay\b|accept|deposit|etransfer|e-?\s*transfer|send\s+funds/i.test(text)
      ? "pay_money"
      : "click_link";
  }
}

/**
 * Shallow clone + conservative fills. Priority: government fine → Interac.
 * Only first matching family applies. Fill-missing only (Phase 1).
 */
export function mapIntelFields(intel: IntelLike, rawText: string): IntelLike {
  const out: IntelLike = { ...intel };
  const text = rawText.trim().toLowerCase();

  if (shouldSkipMapping(out) || text.length < MIN_TEXT_LEN_FOR_MAPPING) return out;

  if (matchesGovernmentFine(text)) {
    applyGovernmentFineFills(out, text);
    return out;
  }
  if (matchesInteracTransfer(text)) {
    applyInteracFills(out, text);
    return out;
  }

  return out;
}

export function verifyMapIntelFields(): void {
  const base = {
    context_quality: "partial",
    submission_route: "likely_scam",
    intel_state: "weak_signal",
    narrative_category: "unknown",
    narrative_family: "unknown",
    authority_type: "unknown",
    payment_intent: "unknown",
    requested_action: "unknown",
    escalation_pattern: "unknown",
  };

  const on = mapIntelFields({ ...base }, "Ontario parking violation notice unpaid ticket MTO pay fine online");
  assert.equal(on.narrative_category, "government_impersonation");
  assert.equal(on.authority_type, "government");
  assert.equal(on.payment_intent, "fee_or_debt_pressure");

  const fr = mapIntelFields(
    { ...base },
    "contravention stationnement billet impayé amende refus de plaque"
  );
  assert.equal(fr.narrative_category, "government_impersonation");

  const interac = mapIntelFields(
    { ...base },
    "You have an Interac e-Transfer deposit. Accept the payment request."
  );
  assert.equal(interac.narrative_category, "financial_phishing");
  assert.equal(interac.authority_type, "financial_institution");
  assert.equal(interac.payment_intent, "direct_payment_request");

  const btc = mapIntelFields(
    { ...base },
    "I hacked your device. Send bitcoin to wallet bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
  );
  assert.equal(btc.narrative_category, "unknown");
  assert.equal(btc.payment_intent, "unknown");

  const thinGov = mapIntelFields(
    { ...base, context_quality: "thin", intel_state: "structured_signal" },
    "parking violation MTO pay fine"
  );
  assert.equal(thinGov.narrative_category, "government_impersonation");

  const frag = mapIntelFields(
    {
      ...base,
      context_quality: "fragment",
      narrative_category: "unknown",
    },
    "https://bit.ly/abc123"
  );
  assert.equal(frag.narrative_category, "unknown");

  const kept = mapIntelFields(
    {
      ...base,
      narrative_category: "delivery_scam",
      narrative_family: "delivery_scam",
    },
    "Ontario parking violation MTO"
  );
  assert.equal(kept.narrative_category, "delivery_scam");
}
