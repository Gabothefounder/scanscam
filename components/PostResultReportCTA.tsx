"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import {
  getPostResultReportCTACopy,
  GUIDE_REPORT_CTA_VARIANT,
  type PostResultReportRiskTier,
} from "@/lib/postResultReportCTA/copy";

export type PostResultReportCTAProps = {
  lang: "en" | "fr";
  riskTier: PostResultReportRiskTier;
  scanId: string;
  source?: string;
  analysisMode?: string | null;
};

type PanelState = "collapsed" | "panel_open" | "submitting" | "redirecting" | "error";

function buildTelemetryProps(args: {
  lang: "en" | "fr";
  riskTier: PostResultReportRiskTier;
  source: string;
  analysisMode?: string | null;
}): Record<string, string> {
  const props: Record<string, string> = {
    source: args.source,
    lang: args.lang,
    risk_tier: args.riskTier,
    cta_variant: GUIDE_REPORT_CTA_VARIANT,
  };
  const mode = String(args.analysisMode ?? "").trim();
  if (mode) props.analysis_mode = mode;
  return props;
}

export function PostResultReportCTA({
  lang,
  riskTier,
  scanId,
  source = "post_scan_result",
  analysisMode,
}: PostResultReportCTAProps) {
  const copy = getPostResultReportCTACopy({ lang, riskTier });
  const router = useRouter();
  const viewedOnceRef = useRef(false);
  const [panelState, setPanelState] = useState<PanelState>("collapsed");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId || viewedOnceRef.current) return;
    const key = `ss_guide_report_cta_viewed:${scanId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    viewedOnceRef.current = true;
    logScanEvent("guide_report_cta_viewed", {
      scan_id: scanId,
      props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
    });
  }, [scanId, lang, riskTier, source, analysisMode]);

  const openPanel = () => {
    if (panelState === "submitting" || panelState === "redirecting") return;
    setErrorMessage(null);
    setPanelState("panel_open");
    if (!scanId) return;
    logScanEvent("guide_report_cta_clicked", {
      scan_id: scanId,
      props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanId || panelState === "submitting" || panelState === "redirecting") return;

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage(copy.errEmail);
      return;
    }

    setErrorMessage(null);
    setPanelState("submitting");

    try {
      const res = await fetch("/api/guide-report-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan_id: scanId,
          email: trimmed,
          risk_tier: riskTier,
          lang,
          source,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        report_url?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok || typeof data.report_url !== "string" || !data.report_url) {
        setPanelState("error");
        setErrorMessage(copy.errSubmit);
        return;
      }

      logScanEvent("guide_report_optin_submitted", {
        scan_id: scanId,
        props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
      });

      logScanEvent("guide_report_unlocked", {
        scan_id: scanId,
        props: buildTelemetryProps({ lang, riskTier, source, analysisMode }),
      });

      setPanelState("redirecting");
      router.push(data.report_url);
    } catch {
      setPanelState("error");
      setErrorMessage(copy.errSubmit);
    }
  };

  const isBusy = panelState === "submitting" || panelState === "redirecting";
  const panelOpen = panelState !== "collapsed";

  return (
    <section
      className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white px-5 py-5 text-slate-900 shadow-sm sm:px-6 sm:py-6"
      aria-labelledby="post-result-report-cta-heading"
    >
      <h3
        id="post-result-report-cta-heading"
        className="text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-xl"
      >
        {copy.title}
      </h3>

      {!panelOpen ? (
        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          onClick={openPanel}
        >
          {copy.buttonLabel}
        </button>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
          <p className="text-sm leading-relaxed text-slate-800">{copy.body}</p>
          <p className="text-sm leading-relaxed text-slate-700">{copy.panelIntro}</p>
          <div>
            <label htmlFor="guide-report-email" className="block text-sm font-medium text-slate-900">
              {copy.emailLabel}
            </label>
            <input
              id="guide-report-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              disabled={isBusy}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder={copy.emailPlaceholder}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {panelState === "redirecting"
              ? copy.redirectingLabel
              : panelState === "submitting"
                ? copy.submittingLabel
                : copy.buttonLabel}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-600">{copy.privacyNote}</p>
          {errorMessage ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
