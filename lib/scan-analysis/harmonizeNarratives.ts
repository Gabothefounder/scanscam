/**
 * Post-merge harmonization of narrative_category (analytics) vs narrative_family (UX).
 *
 * These fields are derived on different paths and can disagree; this pass only fills
 * obvious gaps using a conservative bidirectional map — never weakens a concrete value
 * and never forces alignment when both sides are concrete but conflicting.
 */

import assert from "node:assert/strict";

export type IntelLike = Record<string, unknown>;

/** Category is treated as absent for harmonization (legacy + analytics use unknown/none). */
function isCategoryMissing(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return true;
  const s = value.trim();
  return s === "" || s === "unknown" || s === "none";
}

/** Family is treated as absent (enrichment uses unknown; not "none" in spec). */
function isFamilyMissing(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return true;
  const s = value.trim();
  return s === "" || s === "unknown";
}

/** Safe overlaps only — no law_enforcement / recovery_scam / social_engineering_opener in Phase 1. */
const FAMILY_TO_CATEGORY: Record<string, string> = {
  reward_claim: "prize_scam",
  account_verification: "financial_phishing",
  government_impersonation: "government_impersonation",
  delivery_scam: "delivery_scam",
  employment_scam: "employment_scam",
  investment_fraud: "investment_fraud",
};

const CATEGORY_TO_FAMILY: Record<string, string> = {
  prize_scam: "reward_claim",
  financial_phishing: "account_verification",
  government_impersonation: "government_impersonation",
  delivery_scam: "delivery_scam",
  employment_scam: "employment_scam",
  investment_fraud: "investment_fraud",
};

export function harmonizeNarratives(intel: IntelLike): IntelLike {
  const out: IntelLike = { ...intel };

  const origCat = intel.narrative_category;
  const origFam = intel.narrative_family;

  let nextCat = origCat;
  let nextFam = origFam;

  if (isCategoryMissing(origCat) && !isFamilyMissing(origFam) && typeof origFam === "string") {
    const mapped = FAMILY_TO_CATEGORY[origFam.trim()];
    if (mapped) nextCat = mapped;
  }

  const catForFamilyLookup = nextCat;
  if (
    isFamilyMissing(origFam) &&
    !isCategoryMissing(catForFamilyLookup) &&
    typeof catForFamilyLookup === "string"
  ) {
    const mapped = CATEGORY_TO_FAMILY[catForFamilyLookup.trim()];
    if (mapped) nextFam = mapped;
  }

  if (nextCat !== origCat) out.narrative_category = nextCat;
  if (nextFam !== origFam) out.narrative_family = nextFam;

  return out;
}

/**
 * Manual / CI-adhoc checks (no test runner in repo). Run from a small script or REPL.
 */
export function verifyHarmonizeNarratives(): void {
  assert.equal(
    harmonizeNarratives({ narrative_category: "unknown", narrative_family: "delivery_scam" })
      .narrative_category,
    "delivery_scam"
  );
  assert.equal(
    harmonizeNarratives({ narrative_category: "none", narrative_family: "reward_claim" })
      .narrative_category,
    "prize_scam"
  );
  assert.equal(
    harmonizeNarratives({ narrative_category: "financial_phishing", narrative_family: "unknown" })
      .narrative_family,
    "account_verification"
  );
  const g = harmonizeNarratives({
    narrative_category: "government_impersonation",
    narrative_family: "government_impersonation",
  });
  assert.equal(g.narrative_category, "government_impersonation");
  assert.equal(g.narrative_family, "government_impersonation");
  const conflict = harmonizeNarratives({
    narrative_category: "delivery_scam",
    narrative_family: "reward_claim",
  });
  assert.equal(conflict.narrative_category, "delivery_scam");
  assert.equal(conflict.narrative_family, "reward_claim");
  const bothUnknown = harmonizeNarratives({
    narrative_category: "unknown",
    narrative_family: "unknown",
  });
  assert.equal(bothUnknown.narrative_category, "unknown");
  assert.equal(bothUnknown.narrative_family, "unknown");
}
