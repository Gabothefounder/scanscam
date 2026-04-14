export type InterpretationSurfaceConcept =
  | "behaviorInfraCombo"
  | "brandMismatch"
  | "hiddenDestination"
  | "freeHosting"
  | "suspiciousTld"
  | "suspiciousStructure"
  | "verifyOfficialChannel";

export type ParsedAbuseInterpretationForSurface = {
  brandClaim: string | null;
  officialDomainExpected: boolean;
  brandMismatch: boolean;
  hiddenDestination: boolean;
  domainCategory:
    | "official_like"
    | "free_hosting"
    | "shortener"
    | "redirect_wrapper"
    | "tracking_wrapper"
    | "suspicious_tld"
    | "unknown_structure"
    | null;
  suspiciousStructure: boolean;
  riskBoostFloor: "medium" | "high" | null;
  concepts: InterpretationSurfaceConcept[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function normalizeConceptOrder(concepts: InterpretationSurfaceConcept[]): InterpretationSurfaceConcept[] {
  const set = new Set(concepts);
  const ordered: InterpretationSurfaceConcept[] = [];
  if (set.has("behaviorInfraCombo")) ordered.push("behaviorInfraCombo");
  const priority: InterpretationSurfaceConcept[] = [
    "brandMismatch",
    "hiddenDestination",
    "freeHosting",
    "suspiciousTld",
    "suspiciousStructure",
    "verifyOfficialChannel",
  ];
  for (const c of priority) {
    if (set.has(c)) ordered.push(c);
  }
  return ordered;
}

export function parseAbuseInterpretationForSurface(
  intel: Record<string, unknown>
): ParsedAbuseInterpretationForSurface | null {
  const o = asRecord(intel.abuse_interpretation_v1);
  if (!o) return null;
  if (o.version !== 1) return null;

  const brandClaim = typeof o.brand_claim === "string" && o.brand_claim.trim() ? o.brand_claim.trim() : null;
  const officialDomainExpected = o.official_domain_expected === true;
  const brandMismatch = o.brand_mismatch === true;
  const hiddenDestination = o.hidden_destination === true;
  const suspiciousStructure = o.suspicious_structure === true;
  const domainCategoryRaw = typeof o.domain_category === "string" ? o.domain_category : "";
  const domainCategory =
    domainCategoryRaw === "official_like" ||
    domainCategoryRaw === "free_hosting" ||
    domainCategoryRaw === "shortener" ||
    domainCategoryRaw === "redirect_wrapper" ||
    domainCategoryRaw === "tracking_wrapper" ||
    domainCategoryRaw === "suspicious_tld" ||
    domainCategoryRaw === "unknown_structure"
      ? domainCategoryRaw
      : null;
  const riskBoostFloor =
    o.risk_boost_floor === "high" || o.risk_boost_floor === "medium" ? o.risk_boost_floor : null;

  const infra = Array.isArray(o.infra_explanations)
    ? o.infra_explanations.filter((x): x is string => typeof x === "string")
    : [];
  const flags = Array.isArray(o.interpretation_flags)
    ? o.interpretation_flags.filter((x): x is string => typeof x === "string")
    : [];

  const concepts: InterpretationSurfaceConcept[] = [];
  if (infra.includes("behavior_infra_combo")) concepts.push("behaviorInfraCombo");
  if (brandMismatch && officialDomainExpected) concepts.push("brandMismatch");
  if (hiddenDestination) concepts.push("hiddenDestination");
  if (domainCategory === "free_hosting") concepts.push("freeHosting");
  if (domainCategory === "suspicious_tld") concepts.push("suspiciousTld");
  if (suspiciousStructure || domainCategory === "official_like") concepts.push("suspiciousStructure");
  if (
    infra.includes("verify_official_channel") ||
    flags.includes("official_domain_expected") ||
    riskBoostFloor === "high"
  ) {
    concepts.push("verifyOfficialChannel");
  }

  const ordered = normalizeConceptOrder(concepts);
  if (ordered.length === 0) return null;

  return {
    brandClaim,
    officialDomainExpected,
    brandMismatch,
    hiddenDestination,
    domainCategory,
    suspiciousStructure,
    riskBoostFloor,
    concepts: ordered,
  };
}
