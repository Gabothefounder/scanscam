/**
 * Derives decision-report telemetry and display domain from scan intel_features.
 * Logic mirrors app/result/ResultView.tsx (link_intel v1 + legacy link_artifact).
 */

type ParsedLinkArtifact = {
  url?: string;
  domain: string | null;
  root_domain: string | null;
  tld: string | null;
  is_shortened: boolean;
  is_ip_address: boolean;
  has_suspicious_tld: boolean;
  expansion_status: "expanded" | "failed" | "timeout" | "skipped" | null;
  final_root_domain: string | null;
};

function parseLinkArtifactLegacy(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  const raw = intel.link_artifact;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    url: typeof a.url === "string" ? a.url : undefined,
    domain: typeof a.domain === "string" ? a.domain : null,
    root_domain: typeof a.root_domain === "string" ? a.root_domain : null,
    tld: typeof a.tld === "string" ? a.tld : null,
    is_shortened: Boolean(a.is_shortened),
    is_ip_address: Boolean(a.is_ip_address),
    has_suspicious_tld: Boolean(a.has_suspicious_tld),
    expansion_status: null,
    final_root_domain: null,
  };
}

function parseLinkIntelV1(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  const raw = intel.link_intel;
  if (!raw || typeof raw !== "object") return null;
  const li = raw as Record<string, unknown>;
  if (li.version !== 1) return null;
  const p = li.primary;
  if (!p || typeof p !== "object") return null;
  const pr = p as Record<string, unknown>;
  const flags = pr.flags && typeof pr.flags === "object" ? (pr.flags as Record<string, unknown>) : null;
  let expansion_status: ParsedLinkArtifact["expansion_status"] = null;
  let final_root_domain: string | null = null;
  const exp = li.expansion;
  if (exp && typeof exp === "object" && "status" in exp) {
    const st = String((exp as { status: unknown }).status);
    if (st === "expanded" || st === "failed" || st === "timeout" || st === "skipped") {
      expansion_status = st;
    }
    if (expansion_status === "expanded") {
      const e = exp as Record<string, unknown>;
      const fr = typeof e.final_root_domain === "string" ? e.final_root_domain.trim() : "";
      const fd = typeof e.final_domain === "string" ? e.final_domain.trim() : "";
      final_root_domain = fr || fd || null;
    }
  }
  return {
    url: typeof pr.url === "string" ? pr.url : undefined,
    domain: typeof pr.domain === "string" ? pr.domain : null,
    root_domain: typeof pr.root_domain === "string" ? pr.root_domain : null,
    tld: typeof pr.tld === "string" ? pr.tld : null,
    is_shortened: Boolean(flags?.shortened),
    is_ip_address: Boolean(flags?.ip_host),
    has_suspicious_tld: Boolean(flags?.suspicious_tld),
    expansion_status,
    final_root_domain,
  };
}

export function parseLinkArtifact(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  return parseLinkIntelV1(intel) ?? parseLinkArtifactLegacy(intel);
}

function getLinkIntelV1Slice(intel: Record<string, unknown>): {
  web_risk?: Record<string, unknown>;
  domain_registration?: Record<string, unknown>;
} | null {
  try {
    const raw = intel.link_intel;
    if (!raw || typeof raw !== "object") return null;
    const li = raw as Record<string, unknown>;
    if (li.version !== 1) return null;
    const wr = li.web_risk;
    const dr = li.domain_registration;
    return {
      ...(wr && typeof wr === "object" ? { web_risk: wr as Record<string, unknown> } : {}),
      ...(dr && typeof dr === "object"
        ? { domain_registration: dr as Record<string, unknown> }
        : {}),
    };
  } catch {
    return null;
  }
}

const BRAND_LIKE_HOST_SUBSTRINGS_UI =
  /paypal|amazon|microsoft|apple|google|netflix|chase|wells\s*fargo|desjardins|interac|bank\s*of\s*america|citibank|scotiabank|tdbank|bmo\b/i;

const OFFICIAL_BRAND_ROOT_UI =
  /^(paypal|amazon|microsoft|apple|google|netflix|desjardins|chase|wellsfargo)\.(com|ca|co\.uk|net|org)(\.[a-z]{2})?$/i;

function hostnameMayMimicBrand(domain: string | null, root: string | null): boolean {
  if (!domain || !root) return false;
  const d = domain.toLowerCase();
  const r = root.toLowerCase().replace(/^www\./, "");
  if (!BRAND_LIKE_HOST_SUBSTRINGS_UI.test(d)) return false;
  if (OFFICIAL_BRAND_ROOT_UI.test(r)) return false;
  return true;
}

type DomainSignalBucket = "recent" | "established" | "mid" | "unavailable";

function domainRegistrationAgeDays(slice: { domain_registration?: Record<string, unknown> } | null): number | null {
  const dr = slice?.domain_registration;
  if (!dr || typeof dr !== "object") return null;
  const status = String((dr as { status?: unknown }).status ?? "");
  if (status !== "ok") return null;
  const createdRaw = (dr as { created_at?: unknown }).created_at;
  if (createdRaw == null || typeof createdRaw !== "string" || !createdRaw.trim()) {
    return null;
  }
  const created = new Date(createdRaw.trim());
  if (Number.isNaN(created.getTime())) return null;
  const ageMs = Date.now() - created.getTime();
  if (ageMs < 0) return null;
  return Math.floor(ageMs / 86400000);
}

function getDomainSignalBucket(
  slice: { domain_registration?: Record<string, unknown> } | null
): DomainSignalBucket {
  const ageDays = domainRegistrationAgeDays(slice);
  if (ageDays == null) return "unavailable";
  if (ageDays < 30) return "recent";
  if (ageDays >= 365) return "established";
  return "mid";
}

/** True when intel includes a parsed link with a usable URL or host for link-based checks. */
export function hasUsableLinkFromIntel(intel: Record<string, unknown> | null | undefined): boolean {
  const i = intel && typeof intel === "object" ? intel : {};
  const link = parseLinkArtifact(i);
  if (!link) return false;
  const url = (link.url ?? "").trim();
  const domain = (link.domain ?? "").trim();
  const root = (link.root_domain ?? "").trim();
  const finalRoot = (link.final_root_domain ?? "").trim();
  return Boolean(url || domain || root || finalRoot);
}

function linkTypeTelemetrySlug(link: ParsedLinkArtifact | null): "shortened" | "unusual" | "standard" {
  if (!link) return "standard";
  if (link.is_shortened) return "shortened";
  if (
    link.has_suspicious_tld ||
    link.is_ip_address ||
    hostnameMayMimicBrand(link.domain, link.root_domain)
  ) {
    return "unusual";
  }
  return "standard";
}

function normalizedIntelSlug(intel: Record<string, unknown>, key: string): string {
  const v = intel[key];
  if (v == null) return "";
  const s = String(v).trim().toLowerCase();
  return s;
}

export type ReportTelemetryFromIntel = {
  risk_tier: string;
  input_type: string;
  intel_state: string;
  context_quality: string;
  web_risk_status: string;
  link_type: string;
  domain_signal: string;
  /** Whole days since domain registration when `link_intel.domain_registration` has status ok and created_at; else null. */
  domain_age_days: number | null;
  /** Whether link, domain, and web-risk rows apply (derived from parsed link artifact only). */
  has_usable_link: boolean;
  /** Message-level taxonomy slugs from intel (lowercase); empty when absent — UI maps to human copy and hides unknown/none. */
  narrative_family: string;
  requested_action: string;
  payment_intent: string;
  escalation_pattern: string;
  authority_type: string;
};

/** Build telemetry fields for DecisionReport from stored intel + risk tier. */
export function buildTelemetryFromIntel(
  intel: Record<string, unknown> | null | undefined,
  riskTier: string | null | undefined
): ReportTelemetryFromIntel {
  const i = intel && typeof intel === "object" ? intel : {};
  const link = parseLinkArtifact(i);
  const slice = getLinkIntelV1Slice(i);
  const wr = slice?.web_risk;
  const webRisk =
    wr && typeof wr === "object" ? String((wr as { status?: unknown }).status ?? "none") : "none";
  const bucket = getDomainSignalBucket(slice ?? null);
  const linkSlug = linkTypeTelemetrySlug(link);
  const domainAgeDays = domainRegistrationAgeDays(slice ?? null);
  const has_usable_link = hasUsableLinkFromIntel(i);
  return {
    risk_tier: String(riskTier ?? "low").toLowerCase(),
    input_type: String(i.input_type ?? "unknown"),
    intel_state: String(i.intel_state ?? "unknown"),
    context_quality: String(i.context_quality ?? "unknown"),
    web_risk_status: webRisk,
    link_type: linkSlug,
    domain_signal: bucket,
    domain_age_days: domainAgeDays,
    has_usable_link,
    narrative_family: normalizedIntelSlug(i, "narrative_family"),
    requested_action: normalizedIntelSlug(i, "requested_action"),
    payment_intent: normalizedIntelSlug(i, "payment_intent"),
    escalation_pattern: normalizedIntelSlug(i, "escalation_pattern"),
    authority_type: normalizedIntelSlug(i, "authority_type"),
  };
}

/** Primary host label for "Analyzed link" (root_domain, domain, or URL host). */
export function extractAnalyzedDomainFromIntel(intel: Record<string, unknown> | null | undefined): string {
  const i = intel && typeof intel === "object" ? intel : {};
  const link = parseLinkArtifact(i);
  if (link) {
    const root = (link.root_domain || "").trim();
    if (root) return root;
    const dom = (link.domain || "").trim();
    if (dom) return dom;
    if (link.url) {
      const host = link.url.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
      if (host) return host;
    }
  }
  return "";
}
