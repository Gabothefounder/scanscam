import { extractLinkArtifacts } from "@/lib/scan-analysis/extractLinkArtifacts";
import { expandUrl } from "@/lib/scan-analysis/expandUrl";
import { lookupWebRisk } from "@/lib/scan-analysis/webRiskLookup";
import { lookupDomainRegistration } from "@/lib/scan-analysis/rdapLookup";
import {
  linkIntelFromArtifact,
  type LinkIntelV1,
  type LinkIntelWebRiskV1,
} from "@/lib/scan-analysis/linkIntel";

/**
 * Build external URL intelligence without blocking independent checks serially.
 * Core scan risk does not depend on these lookups; failures degrade to structured
 * "error"/"skipped" metadata and never fail a scan.
 */
export async function enrichLinkIntel(contentText: string): Promise<LinkIntelV1 | null> {
  const extracted = extractLinkArtifacts(contentText);
  if (!extracted) return null;

  const intel = linkIntelFromArtifact(extracted);

  if (intel.primary.flags.shortened) {
    try {
      intel.expansion = await expandUrl(intel.primary.url);
    } catch {
      intel.expansion = { status: "failed" };
    }
  } else {
    intel.expansion = { status: "skipped" };
  }

  let urlForWebRisk: string | null = null;
  let checkedUrlType: "expanded" | "primary" | null = null;

  if (intel.primary.flags.shortened) {
    const exp = intel.expansion;
    if (
      exp?.status === "expanded" &&
      typeof exp.final_url === "string" &&
      exp.final_url.trim()
    ) {
      urlForWebRisk = exp.final_url.trim();
      checkedUrlType = "expanded";
    }
  } else if (intel.primary.url.trim()) {
    urlForWebRisk = intel.primary.url.trim();
    checkedUrlType = "primary";
  }

  const rdapDomain =
    (typeof intel.primary.root_domain === "string" && intel.primary.root_domain.trim()) ||
    (typeof intel.primary.domain === "string" && intel.primary.domain.trim()) ||
    "";

  const checkedAt = new Date().toISOString();

  const [webRisk, domainRegistration] = await Promise.all([
    urlForWebRisk && checkedUrlType
      ? lookupWebRisk(urlForWebRisk)
      : Promise.resolve({ status: "skipped" as const }),
    rdapDomain
      ? lookupDomainRegistration(rdapDomain)
      : Promise.resolve(null),
  ]);

  const webRiskMeta: LinkIntelWebRiskV1 = {
    status: webRisk.status,
    checked_at: checkedAt,
    ...(checkedUrlType ? { checked_url_type: checkedUrlType } : {}),
    ...("threat_types" in webRisk && webRisk.threat_types?.length
      ? { threat_types: webRisk.threat_types }
      : {}),
    ...(webRisk.status === "error"
      ? {
          ...("error_reason" in webRisk && webRisk.error_reason
            ? { error_reason: webRisk.error_reason }
            : {}),
          ...("http_status" in webRisk && typeof webRisk.http_status === "number"
            ? { http_status: webRisk.http_status }
            : {}),
          ...("api_error_message" in webRisk && webRisk.api_error_message
            ? { api_error_message: webRisk.api_error_message }
            : {}),
        }
      : {}),
  };

  intel.web_risk = webRiskMeta;
  if (domainRegistration) intel.domain_registration = domainRegistration;

  return intel;
}
