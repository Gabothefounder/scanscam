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

export type LinkIntelV1 = {
  version: 1;
  primary: LinkIntelPrimaryV1;
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
