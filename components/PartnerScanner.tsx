"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScannerForm } from "@/components/ScannerForm";
import type { PartnerConfig } from "@/lib/partners";

type Props = {
  partner: PartnerConfig;
};

export function PartnerScanner({ partner }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [attribution, setAttribution] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLang(params.get("lang") === "fr" ? "fr" : "en");
    const attr = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
    const out: Record<string, string | null> = {};
    attr.forEach((k) => {
      const v = params.get(k);
      out[k] = v ? v.trim() || null : null;
    });
    setAttribution(out);
    setMounted(true);
  }, []);

  const handleScanSuccess = (result: Record<string, unknown>) => {
    sessionStorage.setItem("scanResult", JSON.stringify(result));
    sessionStorage.setItem("scan_partner", partner.slug);
    const attrProps: Record<string, string> = {};
    if (attribution.utm_source) attrProps.utm_source = attribution.utm_source;
    if (attribution.utm_campaign) attrProps.utm_campaign = attribution.utm_campaign;
    if (attribution.utm_term) attrProps.utm_term = attribution.utm_term;
    if (attribution.utm_medium) attrProps.utm_medium = attribution.utm_medium;
    if (attribution.utm_content) attrProps.utm_content = attribution.utm_content;
    if (attribution.gclid) attrProps.gclid = attribution.gclid;
    if (Object.keys(attrProps).length > 0) {
      sessionStorage.setItem("scan_attribution", JSON.stringify(attrProps));
    }
    const scanId = typeof result.scan_id === "string" ? result.scan_id.trim() : "";
    if (scanId) {
      router.push(`/result/${scanId}?lang=${lang}&partner=${partner.slug}`);
    } else {
      router.push(`/result?lang=${lang}&partner=${partner.slug}`);
    }
  };

  if (!mounted) return null;

  return <ScannerForm lang={lang} onScanSuccess={handleScanSuccess} partner={partner} />;
}
