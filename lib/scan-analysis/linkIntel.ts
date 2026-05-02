/**
 * Canonical URL intel (v1) stored under scans.intel_features.link_intel.
 * Legacy link_artifact is derived only from this structure — no second mapping from raw extraction.
 */

import type { LinkArtifact } from "@/lib/scan-analysis/extractLinkArtifacts";

export type LinkIntelPrimaryV1 = {
  /** Normalized URL (same as legacy link_artifact.url). */
  url: string;
  domain: string | null;
  root_domain: string | null;
  tld: string | null;
  flags: {
    shortened: boolean;
    ip_host: boolean;
    suspicious_tld: boolean;
  };
};

/** Result of expandUrl() — never includes "skipped" (route adds that). */
export type ExpandUrlOutcome = {
  status: "expanded" | "failed" | "timeout";
  final_url?: string;
  final_domain?: string;
  final_root_domain?: string;
  final_tld?: string;
  redirect_count?: number;
};

export type LinkExpansionResult = ExpandUrlOutcome | { status: "skipped" };

export type LinkIntelWebRiskV1 = {
  /** `unknown` may appear on legacy persisted scans (pre–Phase 1 Web Risk mapping). */
  status: "unsafe" | "clean" | "error" | "skipped" | "unknown";
  checked_url_type?: "expanded" | "primary";
  checked_at: string;
  /** Present when status is unsafe and the API returned threat types. */
  threat_types?: string[];
  /** Populated when status is error (diagnostics only). */
  error_reason?: string;
  http_status?: number;
  api_error_message?: string;
};

export type DomainRegistrationLookup =
  | {
      status: "ok";
      source: "rdap";
      created_at: string | null;
      registrar?: string | null;
    }
  | {
      status: "error";
      source: "rdap";
      error_reason?: string;
    }
  | {
      status: "skipped";
      source: "rdap";
      error_reason?: string;
    };

export type LinkIntelV1 = {
  version: 1;
  primary: LinkIntelPrimaryV1;
  /** Populated after optional async expansion (shortened links only). */
  expansion?: LinkExpansionResult;
  /** Optional external URL reputation check; never used for core risk scoring. */
  web_risk?: LinkIntelWebRiskV1;
  /** Optional RDAP-derived registration metadata; never used for core risk scoring. */
  domain_registration?: DomainRegistrationLookup;
};

export function linkIntelFromArtifact(artifact: LinkArtifact): LinkIntelV1 {
  return {
    version: 1,
    primary: {
      url: artifact.url,
      domain: artifact.domain,
      root_domain: artifact.root_domain,
      tld: artifact.tld,
      flags: {
        shortened: artifact.is_shortened,
        ip_host: artifact.is_ip_address,
        suspicious_tld: artifact.has_suspicious_tld,
      },
    },
  };
}

/** Legacy shape for intel_features.link_artifact — derived only from link_intel. */
export function linkArtifactFromLinkIntel(intel: LinkIntelV1): LinkArtifact {
  const p = intel.primary;
  return {
    url: p.url,
    domain: p.domain,
    root_domain: p.root_domain,
    tld: p.tld,
    is_shortened: p.flags.shortened,
    is_ip_address: p.flags.ip_host,
    has_suspicious_tld: p.flags.suspicious_tld,
  };
}
