"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAttribution } from "@/lib/attribution";

export function useScanSuccessNavigation(lang: "en" | "fr") {
  const router = useRouter();

  return useCallback((result: Record<string, unknown>) => {
    sessionStorage.setItem("scanResult", JSON.stringify(result));
    try {
      sessionStorage.removeItem("scan_partner");
    } catch {
      // Storage failures should not block navigation.
    }

    const attr = getAttribution();
    const attrProps: Record<string, string> = {};
    if (attr.utm_source) attrProps.utm_source = attr.utm_source;
    if (attr.utm_campaign) attrProps.utm_campaign = attr.utm_campaign;
    if (attr.utm_term) attrProps.utm_term = attr.utm_term;
    if (attr.utm_medium) attrProps.utm_medium = attr.utm_medium;
    if (attr.utm_content) attrProps.utm_content = attr.utm_content;
    if (attr.gclid) attrProps.gclid = attr.gclid;
    if (Object.keys(attrProps).length > 0) {
      sessionStorage.setItem("scan_attribution", JSON.stringify(attrProps));
    }

    const scanId = typeof result.scan_id === "string" ? result.scan_id.trim() : "";
    router.push(scanId ? `/result/${scanId}?lang=${lang}` : `/result?lang=${lang}`);
  }, [lang, router]);
}
