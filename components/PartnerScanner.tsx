"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScannerForm } from "@/components/ScannerForm";
import { captureAttribution, getAttribution } from "@/lib/attribution";
import type { PartnerConfig } from "@/lib/partners";

type Props = {
  partner: PartnerConfig;
  copyOverrides?: Partial<{
    placeholder: string;
    divider: string;
    uploadLabel: string;
    button: string;
    buttonLoading: string;
  }>;
};

export function PartnerScanner({ partner, copyOverrides }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    captureAttribution();
    const params = new URLSearchParams(window.location.search);
    setLang(params.get("lang") === "fr" ? "fr" : "en");
    setMounted(true);
  }, []);

  const handleScanSuccess = (result: Record<string, unknown>) => {
    sessionStorage.setItem("scanResult", JSON.stringify(result));
    sessionStorage.setItem("scan_partner", partner.slug);
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
    if (scanId) {
      router.push(`/result/${scanId}?lang=${lang}&partner=${partner.slug}`);
    } else {
      router.push(`/result?lang=${lang}&partner=${partner.slug}`);
    }
  };

  if (!mounted) return null;

  return (
    <ScannerForm
      lang={lang}
      onScanSuccess={handleScanSuccess}
      partner={partner}
      copyOverrides={copyOverrides}
    />
  );
}
