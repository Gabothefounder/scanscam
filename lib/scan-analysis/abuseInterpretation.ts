import type { LinkIntelV1 } from "@/lib/scan-analysis/linkIntel";

export type DomainCategory =
  | "official_like"
  | "free_hosting"
  | "shortener"
  | "redirect_wrapper"
  | "tracking_wrapper"
  | "suspicious_tld"
  | "unknown_structure";

export type AbuseInterpretationV1 = {
  version: 1;
  domain_category?: DomainCategory;
  brand_claim?: string;
  brand_claim_source?: "entity" | "text";
  official_domain_expected?: boolean;
  brand_mismatch?: boolean;
  hidden_destination?: boolean;
  suspicious_structure?: boolean;
  interpretation_flags: string[];
  infra_explanations: string[];
  risk_boost_floor?: "medium" | "high";
};

type BrandClaimDef = {
  aliases: string[];
  official_roots: string[];
};

const FREE_HOSTING_ROOTS = new Set([
  "weebly.com",
  "webflow.io",
  "wixsite.com",
  "wixstudio.com",
  "github.io",
  "blogspot.com",
  "netlify.app",
  "vercel.app",
  "pages.dev",
  "replit.app",
  "godaddysites.com",
  "duckdns.org",
  "serv00.net",
]);

const SHORTENER_ROOTS = new Set([
  "bit.ly",
  "is.gd",
  "tinyurl.com",
  "shortlink.st",
  "linkurl.pk",
  "2s.gg",
  "ouo.io",
  "t.co",
]);

const REDIRECT_WRAPPER_HOSTS = new Set([
  "l.facebook.com",
  "can01.safelinks.protection.outlook.com",
  "shared.outlook.inky.com",
]);

const BRAND_CLAIMS: Record<string, BrandClaimDef> = {
  serviceontario: {
    aliases: ["service ontario", "serviceontario", "ontario"],
    official_roots: ["ontario.ca"],
  },
  cra: {
    aliases: ["cra", "arc", "canada revenue agency", "service canada", "servicecanada"],
    official_roots: ["canada.ca"],
  },
  icbc: {
    aliases: ["icbc"],
    official_roots: ["icbc.com"],
  },
  interac: {
    aliases: ["interac", "e-transfer", "etransfer"],
    official_roots: ["interac.ca"],
  },
  intelcom: {
    aliases: ["intelcom"],
    official_roots: ["intelcom.ca"],
  },
  canadapost: {
    aliases: ["canada post", "postes canada", "canadapost"],
    official_roots: ["canadapost-postescanada.ca"],
  },
  purolator: {
    aliases: ["purolator"],
    official_roots: ["purolator.com"],
  },
  fedex: {
    aliases: ["fedex", "federal express"],
    official_roots: ["fedex.com"],
  },
  dhl: {
    aliases: ["dhl"],
    official_roots: ["dhl.com"],
  },
  microsoft: {
    aliases: ["microsoft", "office 365", "outlook", "live account"],
    official_roots: ["microsoft.com", "live.com", "outlook.com", "office.com"],
  },
  bell: {
    aliases: ["bell", "bell canada"],
    official_roots: ["bell.ca"],
  },
  amazon: {
    aliases: ["amazon"],
    official_roots: ["amazon.com", "amazon.ca"],
  },
  paypal: {
    aliases: ["paypal"],
    official_roots: ["paypal.com"],
  },
  roblox: {
    aliases: ["roblox"],
    official_roots: ["roblox.com"],
  },
  costco: {
    aliases: ["costco"],
    official_roots: ["costco.com", "costco.ca"],
  },
};

const ENTITY_TO_CLAIM: Record<string, string> = {
  cra: "cra",
  service_canada: "cra",
  canada_post: "canadapost",
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function normalizeRoot(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/^www\./, "");
  return s || null;
}

function hostMatchesRoot(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}

function extractCheckedHost(linkIntel: LinkIntelV1 | null | undefined): string | null {
  if (!linkIntel) return null;
  const exp = linkIntel.expansion;
  if (exp && exp.status === "expanded") {
    return normalizeRoot(exp.final_root_domain) ?? normalizeRoot(exp.final_domain);
  }
  return normalizeRoot(linkIntel.primary.root_domain) ?? normalizeRoot(linkIntel.primary.domain);
}

function isRedirectWrapper(linkIntel: LinkIntelV1): boolean {
  const primaryDomain = normalizeRoot(linkIntel.primary.domain);
  const url = String(linkIntel.primary.url ?? "");
  if (primaryDomain && REDIRECT_WRAPPER_HOSTS.has(primaryDomain)) return true;
  if (primaryDomain === "google.com" && /^https?:\/\/(?:www\.)?google\.com\/url\b/i.test(url)) {
    return true;
  }
  return false;
}

function isTrackingWrapper(linkIntel: LinkIntelV1): boolean {
  const urlRaw = String(linkIntel.primary.url ?? "");
  if (!urlRaw) return false;
  try {
    const u = new URL(urlRaw);
    if (!u.search) return false;
    const q = u.search.toLowerCase();
    return /(?:[?&])(url|u|redirect|redirect_url|target|dest)=/.test(q);
  } catch {
    return false;
  }
}

function classifyDomainCategory(linkIntel: LinkIntelV1): DomainCategory {
  const checkedHost = extractCheckedHost(linkIntel);
  const suspiciousTld = Boolean(linkIntel.primary.flags?.suspicious_tld);
  const shortened = Boolean(linkIntel.primary.flags?.shortened);

  if (shortened || (checkedHost != null && SHORTENER_ROOTS.has(checkedHost))) return "shortener";
  if (isRedirectWrapper(linkIntel)) return "redirect_wrapper";
  if (isTrackingWrapper(linkIntel)) return "tracking_wrapper";
  if (checkedHost != null && FREE_HOSTING_ROOTS.has(checkedHost)) return "free_hosting";
  if (suspiciousTld) return "suspicious_tld";
  return "unknown_structure";
}

function looksOfficialLike(checkedHost: string | null, claim: string | null): boolean {
  if (!checkedHost || !claim) return false;
  const def = BRAND_CLAIMS[claim];
  if (!def) return false;
  if (def.official_roots.some((r) => hostMatchesRoot(checkedHost, r))) return false;
  const token = claim === "serviceontario" ? "ontario" : claim === "canadapost" ? "canadapost" : claim;
  return checkedHost.includes(token);
}

function detectClaimFromText(text: string): string | null {
  const low = text.toLowerCase();
  for (const [claim, def] of Object.entries(BRAND_CLAIMS)) {
    for (const alias of def.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(low)) return claim;
    }
  }
  return null;
}

function requestedActionNeedsOfficialDomain(action: string, narrativeFamily: string): boolean {
  if (action === "submit_credentials" || action === "pay_money") return true;
  if (action === "click_link" && narrativeFamily === "account_verification") return true;
  return false;
}

function hasStrongAuthorityAccountPressure(rawText: string | null | undefined): boolean {
  if (!rawText) return false;
  const low = rawText.toLowerCase();
  const hasAccountPressure =
    /\b(account|compte)\b.*\b(blocked|suspended|locked|verify|verification|login|sign\s*in|confirm)\b/i.test(
      low
    ) ||
    /\b(verify|verification|login|sign\s*in|confirm)\b.*\b(account|identity|identité)\b/i.test(low) ||
    /\b(payment\s+due|past\s+due|final\s+notice|action\s+required|suspend)\b/i.test(low);
  return hasAccountPressure;
}

function hasStrongBehaviorSignal(args: {
  requestedAction: string;
  authorityType: string;
  impersonationEntity: string;
  officialExpected: boolean;
  brandMismatch: boolean;
  rawText?: string | null;
}): boolean {
  const actionStrong = args.requestedAction === "submit_credentials" || args.requestedAction === "pay_money";
  const authorityPresent =
    args.authorityType === "government" ||
    args.authorityType === "financial_institution" ||
    (args.impersonationEntity && args.impersonationEntity !== "unknown");
  const authorityPressure = authorityPresent && hasStrongAuthorityAccountPressure(args.rawText);
  const mismatchSignal = args.officialExpected && args.brandMismatch;
  return actionStrong || authorityPressure || mismatchSignal;
}

export function buildAbuseInterpretation(args: {
  intel: Record<string, unknown>;
  linkIntel?: LinkIntelV1 | null;
  rawText?: string | null;
}): AbuseInterpretationV1 | null {
  try {
    const interpretationFlags: string[] = [];
    const infraExplanations: string[] = [];
    const intel = args.intel ?? {};
    const linkIntel = args.linkIntel ?? null;
    if (!linkIntel) return null;

    const narrativeFamily = String(intel.narrative_family ?? intel.narrative_category ?? "");
    const requestedAction = String(intel.requested_action ?? "");
    const impersonationEntity = String(intel.impersonation_entity ?? "");
    const authorityType = String(intel.authority_type ?? "");
    const threatStage = String(intel.threat_stage ?? "");

    const checkedHost = extractCheckedHost(linkIntel);
    const domainCategory = classifyDomainCategory(linkIntel);
    const hiddenDestination = domainCategory === "shortener" || domainCategory === "redirect_wrapper";

    let brandClaim: string | null = null;
    let brandClaimSource: "entity" | "text" | undefined;
    if (ENTITY_TO_CLAIM[impersonationEntity]) {
      brandClaim = ENTITY_TO_CLAIM[impersonationEntity];
      brandClaimSource = "entity";
    } else if (args.rawText && args.rawText.trim().length > 0) {
      const fromText = detectClaimFromText(args.rawText);
      if (fromText) {
        brandClaim = fromText;
        brandClaimSource = "text";
      }
    }

    const officialExpected =
      Boolean(brandClaim) &&
      (authorityType === "government" ||
        authorityType === "financial_institution" ||
        requestedActionNeedsOfficialDomain(requestedAction, narrativeFamily));

    let brandMismatch = false;
    if (brandClaim && checkedHost) {
      const def = BRAND_CLAIMS[brandClaim];
      if (def && !def.official_roots.some((root) => hostMatchesRoot(checkedHost, root))) {
        brandMismatch = true;
      }
    }

    let suspiciousStructure =
      domainCategory === "free_hosting" ||
      domainCategory === "suspicious_tld" ||
      domainCategory === "official_like";
    if (!suspiciousStructure && looksOfficialLike(checkedHost, brandClaim)) {
      suspiciousStructure = true;
    }

    if (brandMismatch) {
      interpretationFlags.push("brand_mismatch");
      if (requestedAction === "submit_credentials") {
        infraExplanations.push("brand_mismatch_login");
      } else if (requestedAction === "pay_money") {
        infraExplanations.push("brand_mismatch_payment");
      }
    }
    if (officialExpected) {
      interpretationFlags.push("official_domain_expected");
      infraExplanations.push("authority_official_expectation");
    }
    if (hiddenDestination) {
      interpretationFlags.push("hidden_destination");
      infraExplanations.push(
        domainCategory === "redirect_wrapper" ? "redirect_wrapper_hidden_dest" : "shortened_hidden_dest"
      );
    }
    if (domainCategory === "free_hosting") {
      interpretationFlags.push("infra_free_hosting");
      infraExplanations.push("free_hosting_risk");
    } else if (domainCategory === "suspicious_tld") {
      interpretationFlags.push("infra_suspicious_tld");
      infraExplanations.push("suspicious_structure");
    } else if (domainCategory === "official_like") {
      interpretationFlags.push("infra_official_like");
      infraExplanations.push("suspicious_structure");
    }
    if (suspiciousStructure) {
      interpretationFlags.push("suspicious_structure");
    }

    let riskBoostFloor: "medium" | "high" | undefined;
    const deliveryLike =
      narrativeFamily === "delivery_scam" ||
      narrativeFamily === "government_impersonation" ||
      (args.rawText != null && /\bdelivery|package|tracking|redeliver|postes\s+canada|canada\s+post\b/i.test(args.rawText));
    const suspiciousInfra = suspiciousStructure || hiddenDestination;
    const urgencyOrThreat =
      threatStage === "payment_extraction" ||
      threatStage === "credential_capture" ||
      (args.rawText != null &&
        /\burgent|immediately|asap|final notice|deadline|act now|suspend|warrant|arrest|legal action\b/i.test(
          args.rawText.toLowerCase()
        ));
    const strongBehaviorSignal = hasStrongBehaviorSignal({
      requestedAction,
      authorityType,
      impersonationEntity,
      officialExpected,
      brandMismatch,
      rawText: args.rawText,
    });
    const hiddenStrongBehaviorForHigh =
      hiddenDestination &&
      strongBehaviorSignal &&
      (requestedAction === "submit_credentials" ||
        requestedAction === "pay_money" ||
        (officialExpected && brandMismatch) ||
        hasStrongAuthorityAccountPressure(args.rawText));

    if (
      requestedAction === "submit_credentials" &&
      brandMismatch &&
      officialExpected
    ) {
      riskBoostFloor = "high";
      interpretationFlags.push("risk_floor_high_credentials_mismatch");
      infraExplanations.push("behavior_infra_combo");
    } else if (requestedAction === "pay_money" && brandMismatch && officialExpected) {
      riskBoostFloor = "high";
      interpretationFlags.push("risk_floor_high_payment_mismatch");
      infraExplanations.push("behavior_infra_combo");
    } else if (deliveryLike && requestedAction === "pay_money" && suspiciousInfra && brandMismatch) {
      riskBoostFloor = "high";
      interpretationFlags.push("risk_floor_high_delivery_infra_combo");
      infraExplanations.push("behavior_infra_combo");
    } else if (hiddenStrongBehaviorForHigh) {
      riskBoostFloor = "high";
      interpretationFlags.push("risk_floor_high_hidden_destination_strong_behavior");
      infraExplanations.push("behavior_infra_combo");
    } else if (urgencyOrThreat && hiddenDestination) {
      riskBoostFloor = "medium";
      interpretationFlags.push("risk_floor_medium_urgency_hidden_destination");
      infraExplanations.push("behavior_infra_combo");
    }

    if (
      brandMismatch ||
      suspiciousInfra ||
      officialExpected ||
      hiddenDestination ||
      riskBoostFloor
    ) {
      infraExplanations.push("verify_official_channel");
    }

    const dedupFlags = Array.from(new Set(interpretationFlags));
    const dedupExplanations = Array.from(new Set(infraExplanations));

    if (
      dedupFlags.length === 0 &&
      dedupExplanations.length === 0 &&
      !riskBoostFloor &&
      domainCategory === "unknown_structure"
    ) {
      return null;
    }

    const out: AbuseInterpretationV1 = {
      version: 1,
      interpretation_flags: dedupFlags,
      infra_explanations: dedupExplanations,
    };
    if (domainCategory && domainCategory !== "unknown_structure") out.domain_category = domainCategory;
    if (brandClaim) out.brand_claim = brandClaim;
    if (brandClaimSource) out.brand_claim_source = brandClaimSource;
    if (officialExpected) out.official_domain_expected = true;
    if (brandMismatch) out.brand_mismatch = true;
    if (hiddenDestination) out.hidden_destination = true;
    if (suspiciousStructure) out.suspicious_structure = true;
    if (riskBoostFloor) out.risk_boost_floor = riskBoostFloor;
    return out;
  } catch {
    return null;
  }
}
