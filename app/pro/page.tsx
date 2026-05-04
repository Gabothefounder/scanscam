"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getDecisionReportSalesCopy } from "@/lib/proReports/getDecisionReportSalesCopy";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

type Lang = "en" | "fr";

type SalesTelemetry = {
  risk_tier: string;
  input_type: string;
  intel_state: string;
  context_quality: string;
  web_risk_status: string;
  link_type: string;
  domain_signal: string;
};

type BenefitStep = { heading: string; body: string };

type UiLabels = {
  benefitJourneyTitle: string;
  benefitSteps: readonly BenefitStep[];
  contextTitle: string;
  detectedBridgeLine: string;
  riskLevel: string;
  linkType: string;
  domainSignal: string;
  reportIncludesTitle: string;
  reportIncludesHelper: string;
  reportIncludesItems: readonly BenefitStep[];
  closingBenefitLine: string;
  importantLimitsHeading: string;
  ctaBetaNote: string;
  backResult: string;
  backScan: string;
};

const uiLabels: Record<Lang, UiLabels> = {
  en: {
    benefitJourneyTitle: "How the report helps",
    benefitSteps: [
      {
        heading: "Get clear faster",
        body: "See what ScanScam found and why it matters.",
      },
      {
        heading: "Know what to do next",
        body: "Get a clearer recommendation for how to proceed.",
      },
      {
        heading: "Keep a shareable record",
        body: "Save a time-stamped report you can keep or send to someone you trust.",
      },
    ],
    contextTitle: "What ScanScam already detected",
    detectedBridgeLine:
      "The free scan gives you the first read. The full report turns it into a clearer decision.",
    riskLevel: "Risk level",
    linkType: "Link type",
    domainSignal: "Domain signal",
    reportIncludesTitle: "Inside the full report",
    reportIncludesHelper: "A clear, shareable breakdown built from this scan.",
    reportIncludesItems: [
      {
        heading: "Recommendation",
        body: "What to do next based on the available signals.",
      },
      {
        heading: "Reasoning",
        body: "Why the result points in that direction.",
      },
      {
        heading: "Limits",
        body: "What remains unknown or cannot be confirmed.",
      },
      {
        heading: "Next steps",
        body: "What to do if you clicked, replied, paid, or shared information.",
      },
      {
        heading: "Shareable link",
        body: "A private report link you can send to someone you trust.",
      },
      {
        heading: "Time-stamped record",
        body: "A clear scan record you can keep or use to explain the situation.",
      },
    ],
    closingBenefitLine:
      "Move from uncertainty to a clearer next step — with a shareable record you can keep.",
    importantLimitsHeading: "Important limits",
    ctaBetaNote:
      "Beta access: today, you can unlock it for free after answering 4 short questions.",
    backResult: "Back to result",
    backScan: "Back to scanner",
  },
  fr: {
    benefitJourneyTitle: "Comment le rapport aide",
    benefitSteps: [
      {
        heading: "Comprendre plus vite",
        body: "Voyez ce que ScanScam a trouvé et pourquoi cela compte.",
      },
      {
        heading: "Savoir quoi faire ensuite",
        body: "Obtenez une recommandation plus claire pour la suite.",
      },
      {
        heading: "Garder une trace partageable",
        body: "Conservez un rapport horodaté que vous pouvez garder ou envoyer à une personne de confiance.",
      },
    ],
    contextTitle: "Ce que ScanScam a déjà détecté",
    detectedBridgeLine:
      "Le scan gratuit vous donne une première lecture. Le rapport complet la transforme en décision plus claire.",
    riskLevel: "Niveau de risque",
    linkType: "Type de lien",
    domainSignal: "Signal du domaine",
    reportIncludesTitle: "Dans le rapport complet",
    reportIncludesHelper: "Un résumé clair et partageable construit à partir de ce scan.",
    reportIncludesItems: [
      {
        heading: "Recommandation",
        body: "Quoi faire ensuite selon les signaux disponibles.",
      },
      {
        heading: "Raisonnement",
        body: "Pourquoi le résultat va dans cette direction.",
      },
      {
        heading: "Limites",
        body: "Ce qui reste inconnu ou ne peut pas être confirmé.",
      },
      {
        heading: "Prochaines étapes",
        body: "Quoi faire si vous avez déjà cliqué, répondu, payé ou partagé des informations.",
      },
      {
        heading: "Lien partageable",
        body: "Un lien privé que vous pouvez envoyer à une personne de confiance.",
      },
      {
        heading: "Trace horodatée",
        body: "Un résumé du scan que vous pouvez garder ou utiliser pour expliquer la situation.",
      },
    ],
    closingBenefitLine:
      "Passez de l’incertitude à une prochaine étape plus claire — avec une trace partageable que vous pouvez garder.",
    importantLimitsHeading: "Limites importantes",
    ctaBetaNote:
      "Accès bêta : aujourd’hui, vous pouvez le déverrouiller gratuitement en répondant à 4 courtes questions.",
    backResult: "Retour au résultat",
    backScan: "Retour à l’analyse",
  },
};

function mapOrPassThrough(table: Record<string, string>, raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!k) return "—";
  if (table[k]) return table[k];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function displayRiskTier(lang: Lang, raw: string): string {
  const t =
    lang === "fr"
      ? ({ low: "Faible", medium: "Moyen", high: "Élevé" } as Record<string, string>)
      : ({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>);
  return mapOrPassThrough(t, raw);
}

function displayLinkType(lang: Lang, raw: string): string {
  const t =
    lang === "fr"
      ? ({ shortened: "Raccourci", unusual: "Inhabituel", standard: "Courant" } as Record<string, string>)
      : ({ shortened: "Shortened", unusual: "Unusual", standard: "Standard" } as Record<string, string>);
  return mapOrPassThrough(t, raw);
}

function displayDomainSignal(lang: Lang, raw: string): string {
  const t =
    lang === "fr"
      ? ({
          recent: "Domaine récent",
          established: "Domaine établi",
          mid: "Domaine d’âge intermédiaire",
          unavailable: "Indisponible",
        } as Record<string, string>)
      : ({
          recent: "Recently registered domain",
          established: "Established domain",
          mid: "Mid-age domain",
          unavailable: "Unavailable",
        } as Record<string, string>);
  return mapOrPassThrough(t, raw);
}

function buildTelemetryProps(tel: SalesTelemetry, reason: string): Record<string, string> {
  const props: Record<string, string> = {
    flow: "beta",
    price: "5",
    cta_reason: reason || "unknown",
  };
  const add = (k: keyof SalesTelemetry) => {
    const v = tel[k];
    if (typeof v === "string" && v.trim().length > 0) props[k] = v.trim();
  };
  add("risk_tier");
  add("input_type");
  add("intel_state");
  add("context_quality");
  add("web_risk_status");
  add("link_type");
  add("domain_signal");
  return props;
}

function emphasizeSubheadline(text: string, lang: Lang): ReactNode {
  const phrases =
    lang === "fr"
      ? [
          "ce que le message pourrait chercher à vous faire faire",
          "quelles étapes suivre maintenant",
          "les prochaines étapes",
          "ce qui reste inconnu",
          "quoi faire ensuite",
        ]
      : [
          "what the message may be trying to get you to do",
          "what remains unknown",
          "what steps to take now",
          "your next steps",
          "what to do next",
        ];

  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  const lowerSet = new Set(phrases.map((p) => p.toLowerCase()));

  return (
    <>
      {parts.map((part, i) =>
        lowerSet.has(part.toLowerCase()) ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ProSalesInner() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [scanId, setScanId] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [reason, setReason] = useState("");
  const [partner, setPartner] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<SalesTelemetry | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = (params.get("scan_id") ?? "").trim();
    setScanId(sid);
    setLang(params.get("lang") === "fr" ? "fr" : "en");
    setReason((params.get("reason") ?? "").trim());
    const p = params.get("partner")?.trim();
    setPartner(p && p.length > 0 ? p : null);
    const pick = (k: keyof SalesTelemetry) => (params.get(k) ?? "").trim();
    setTelemetry({
      risk_tier: pick("risk_tier"),
      input_type: pick("input_type"),
      intel_state: pick("intel_state"),
      context_quality: pick("context_quality"),
      web_risk_status: pick("web_risk_status"),
      link_type: pick("link_type"),
      domain_signal: pick("domain_signal"),
    });
    setMounted(true);
  }, []);

  const labels = uiLabels[lang];

  const sales = useMemo(() => {
    if (!telemetry) {
      return getDecisionReportSalesCopy({
        lang,
        riskTier: "low",
        isLimitedContext: false,
        isLinkOnly: false,
        linkType: "",
        domainSignal: "",
      });
    }
    const rawRisk = String(telemetry.risk_tier ?? "low").toLowerCase();
    const normalizedRisk =
      rawRisk === "medium" || rawRisk === "high" ? (rawRisk as "medium" | "high") : "low";
    const intel = telemetry.intel_state.trim().toLowerCase();
    const cq = telemetry.context_quality.trim().toLowerCase();
    const isLimitedContext =
      intel === "insufficient_context" ||
      reason === "insufficient_context" ||
      cq === "fragment" ||
      cq === "thin";
    const isLinkOnly = telemetry.input_type.trim().toLowerCase() === "link_only";

    return getDecisionReportSalesCopy({
      lang,
      riskTier: normalizedRisk,
      isLimitedContext,
      isLinkOnly,
      linkType: telemetry.link_type,
      domainSignal: telemetry.domain_signal,
    });
  }, [lang, telemetry, reason]);

  useEffect(() => {
    if (!mounted || !telemetry) return;
    const key = `ss_pro_sales_viewed:${scanId || "anon"}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const props = buildTelemetryProps(telemetry, reason);
    logScanEvent("pro_sales_viewed", scanId ? { scan_id: scanId, props } : { props });
  }, [mounted, scanId, reason, telemetry]);

  const onUnlock = () => {
    if (telemetry) {
      const props = buildTelemetryProps(telemetry, reason);
      logScanEvent("pro_unlock_clicked", scanId ? { scan_id: scanId, props } : { props });
    }
    const q = typeof window !== "undefined" ? window.location.search.slice(1) : "";
    router.push(q ? `/pro/checkout?${q}` : "/pro/checkout");
  };

  if (!mounted || !telemetry) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center p-6 text-gray-600">
        Loading…
      </div>
    );
  }

  const backHref =
    scanId.length > 0
      ? `/result/${encodeURIComponent(scanId)}?lang=${lang}${partner ? `&partner=${encodeURIComponent(partner)}` : ""}`
      : `/scan?lang=${lang}`;

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-950">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_14px_rgba(15,23,42,0.06)] sm:p-8">
          <header className="border-b border-slate-200 pb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">ScanScam</p>
            <div className="mt-2 max-w-prose">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{sales.headline}</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {emphasizeSubheadline(sales.subheadline, lang)}
              </p>
            </div>
          </header>

          <section className="mt-5" aria-labelledby="benefit-journey">
            <h2 id="benefit-journey" className="text-sm font-semibold text-slate-950">
              {labels.benefitJourneyTitle}
            </h2>
            <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
                {labels.benefitSteps.map((step) => (
                  <div key={step.heading} className="bg-white px-3 py-3 sm:px-4 sm:py-3.5">
                    <h3 className="text-[13px] font-semibold text-slate-950">{step.heading}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6" aria-labelledby="context-summary">
            <h2 id="context-summary" className="text-sm font-semibold text-slate-950">
              {labels.contextTitle}
            </h2>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-3.5">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-slate-800 sm:grid-cols-3 sm:text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-1.5 sm:flex-col sm:gap-0">
                  <dt className="shrink-0 text-slate-600">{labels.riskLevel}</dt>
                  <dd className="font-semibold text-slate-950">{displayRiskTier(lang, telemetry.risk_tier)}</dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 sm:flex-col sm:gap-0">
                  <dt className="shrink-0 text-slate-600">{labels.linkType}</dt>
                  <dd className="font-semibold text-slate-950">{displayLinkType(lang, telemetry.link_type)}</dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-1.5 sm:flex-col sm:gap-0">
                  <dt className="shrink-0 text-slate-600">{labels.domainSignal}</dt>
                  <dd className="font-semibold text-slate-950">{displayDomainSignal(lang, telemetry.domain_signal)}</dd>
                </div>
              </dl>
              <p className="mt-2.5 border-t border-slate-200 pt-2.5 text-xs leading-relaxed text-slate-700">
                {sales.detectedContextLine}
              </p>
            </div>
          </section>

          <div className="mt-7">
            <p className="border-l-[3px] border-amber-500/85 pl-3 text-sm font-semibold leading-snug text-slate-900">
              {labels.detectedBridgeLine}
            </p>

            <section
              className="mt-3 overflow-hidden rounded-2xl border-2 border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50 shadow-[0_2px_8px_rgba(15,23,42,0.08),0_8px_24px_rgba(15,23,42,0.06)]"
              aria-labelledby="report-includes"
            >
              <div className="border-b border-slate-200 bg-slate-100/90 px-4 py-4 sm:px-6 sm:py-5">
                <h2 id="report-includes" className="text-lg font-semibold tracking-tight text-slate-950">
                  {labels.reportIncludesTitle}
                </h2>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-slate-600">
                  {labels.reportIncludesHelper}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 bg-slate-100/50 p-4 sm:grid-cols-2 sm:gap-3.5 sm:p-5">
                {labels.reportIncludesItems.map((item) => (
                  <div
                    key={item.heading}
                    className="flex min-h-[5.75rem] flex-col rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm sm:min-h-[6rem] sm:px-4 sm:py-3.5"
                  >
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      {item.heading}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-800">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6" aria-labelledby="important-limits">
            <h2
              id="important-limits"
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
            >
              {labels.importantLimitsHeading}
            </h2>
            <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
              {sales.importantLimits}
            </p>
          </section>

          <section className="mt-6 border-t border-slate-200 pt-6" aria-label="Purchase">
            <div className="rounded-xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-amber-50/70 px-4 py-5 shadow-sm sm:px-5">
              <p className="mb-4 text-center text-sm font-semibold leading-snug text-slate-900 sm:text-left">
                {labels.closingBenefitLine}
              </p>
              <button
                type="button"
                onClick={onUnlock}
                className="w-full rounded-lg bg-amber-800 px-4 py-3.5 text-center text-base font-semibold text-white shadow-md transition-colors hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                {sales.ctaLabel}
              </button>
              <p className="mt-2 text-center text-xs leading-relaxed text-slate-700">{labels.ctaBetaNote}</p>
              <p className="mt-3 text-center text-xs leading-relaxed text-slate-600">{sales.trustFooter}</p>
            </div>
          </section>
        </div>

        <footer className="mt-6 px-1">
          <a
            href={backHref}
            className="text-sm text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
          >
            {scanId.length > 0 ? labels.backResult : labels.backScan}
          </a>
        </footer>
      </main>
    </div>
  );
}

export default function ProSalesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center p-6 text-gray-600">Loading…</div>
      }
    >
      <ProSalesInner />
    </Suspense>
  );
}
