"use client";

import { useEffect, useRef } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import {
  buildHumanReviewCallMailtoHref,
  getHumanReviewCallCTACopy,
  HUMAN_REVIEW_CTA_VARIANT,
  type HumanReviewCallRiskTier,
} from "@/lib/humanReviewCallCTA/copy";

export type HumanReviewCallCTAProps = {
  lang: "en" | "fr";
  riskTier: HumanReviewCallRiskTier;
  scanId: string;
  source?: string;
  analysisMode?: string | null;
};

function buildTelemetryProps(args: {
  lang: "en" | "fr";
  riskTier: HumanReviewCallRiskTier;
  source: string;
  analysisMode?: string | null;
}): Record<string, string> {
  const props: Record<string, string> = {
    source: args.source,
    lang: args.lang,
    risk_tier: args.riskTier,
    cta_variant: HUMAN_REVIEW_CTA_VARIANT,
  };
  const mode = String(args.analysisMode ?? "").trim();
  if (mode) props.analysis_mode = mode;
  return props;
}

export function HumanReviewCallCTA({
  lang,
  riskTier,
  scanId,
  source = "post_scan_result",
  analysisMode,
}: HumanReviewCallCTAProps) {
  const copy = getHumanReviewCallCTACopy({ lang, riskTier });
  const mailtoHref = buildHumanReviewCallMailtoHref(copy);
  const viewedOnceRef = useRef(false);

  useEffect(() => {
    if (!scanId || viewedOnceRef.current) return;
    const key = `ss_human_review_cta_viewed:${scanId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    viewedOnceRef.current = true;
    logScanEvent("human_review_cta_viewed", {
      scan_id: scanId,
      props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
    });
  }, [scanId, lang, riskTier, source, analysisMode]);

  return (
    <section
      className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white px-5 py-5 text-slate-900 shadow-sm sm:px-6 sm:py-6"
      aria-labelledby="human-review-call-cta-heading"
    >
      <h3
        id="human-review-call-cta-heading"
        className="text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-xl"
      >
        {copy.headline}
      </h3>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-800">
        {copy.bodyParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-900">{copy.betaPricing}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{copy.noJudgment}</p>
      <a
        href={mailtoHref}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 sm:w-auto"
        onClick={() => {
          if (!scanId) return;
          logScanEvent("human_review_cta_clicked", {
            scan_id: scanId,
            props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
          });
        }}
      >
        {copy.buttonLabel}
      </a>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{copy.safetyNote}</p>
    </section>
  );
}
