"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSalesIntentFromParams, type SalesIntentBucket } from "@/lib/proReports/salesIntent";
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

type CopyBlock = {
  emotionalSubtitle: string;
  contextTitle: string;
  riskLevel: string;
  linkType: string;
  domainSignal: string;
  threatDb: string;
  threatDbUnsafe: string;
  limitedContextNote: string;
  valueTitle: string;
  valueBullets: readonly string[];
  useTitle: string;
  useBullets: readonly string[];
  previewTitle: string;
  videoTitle: string;
  videoBody: string;
  videoSoon: string;
  ctaUnlock: string;
  ctaBetaNote: string;
  trustNote: string;
  backResult: string;
  backScan: string;
  hero: Record<SalesIntentBucket, string>;
  previewLine1: Record<SalesIntentBucket, string>;
  previewLine2: Record<SalesIntentBucket, string>;
};

const copy: Record<Lang, CopyBlock> = {
  en: {
    emotionalSubtitle:
      "You already received the free scan. The full report turns the detected signals into a clear recommendation, likely scenarios, and next steps.",
    contextTitle: "What ScanScam already detected",
    riskLevel: "Risk level",
    linkType: "Link type",
    domainSignal: "Domain signal",
    threatDb: "Threat database",
    threatDbUnsafe: "Flagged in threat database",
    limitedContextNote:
      "This scan has limited context, so the report avoids overclaiming and focuses on the safest next step.",
    valueTitle: "The full report gives you:",
    valueBullets: [
      "A clear recommendation",
      "Why this deserves caution",
      "What may happen if you proceed",
      "What scammers may be trying to get",
      "What to do if you already clicked or shared information",
      "A secure report link you can send to someone else",
    ],
    useTitle: "Use it to:",
    useBullets: [
      "decide what to do next",
      "explain the situation to someone else",
      "send to a colleague, IT, support team, or family member",
      "keep a time-stamped record of the scan",
    ],
    previewTitle: "Example from your report",
    videoTitle: "1-minute explanation",
    videoBody:
      "Gabriel from ScanScam explains how to read this report and what to do before acting.",
    videoSoon: "Video coming soon",
    ctaUnlock: "Unlock full report — $5",
    ctaBetaNote:
      "Beta access: today, you can unlock it for free after answering 4 short questions.",
    trustNote: "No account required. Secure report link valid for 21 days.",
    backResult: "Back to result",
    backScan: "Back to scanner",
    hero: {
      link: "Get a clearer answer before you click",
      full_message: "Understand what this message may be trying to do",
      insufficient: "Turn this scan into a clearer decision report",
    },
    previewLine1: {
      link: "Recommended action: Treat this link as untrusted until verified through an official source.",
      full_message:
        "Recommended action: Do not respond until the message is verified through an official source.",
      insufficient:
        "Recommended action: Do not act until the source and requested action are verified.",
    },
    previewLine2: {
      link: "Why: The scan detected a recently registered domain and limited surrounding context.",
      full_message: "Why: The scan detected patterns commonly used to create urgency or pressure.",
      insufficient:
        "Why: The scan found cautionary signals, but not enough context to confirm the full situation.",
    },
  },
  fr: {
    emotionalSubtitle:
      "Vous avez déjà reçu l’analyse gratuite. Le rapport complet transforme les signaux détectés en recommandation claire, scénarios probables et prochaines étapes.",
    contextTitle: "Ce que ScanScam a déjà détecté",
    riskLevel: "Niveau de risque",
    linkType: "Type de lien",
    domainSignal: "Signal du domaine",
    threatDb: "Base de menaces",
    threatDbUnsafe: "Signalée dans la base de menaces",
    limitedContextNote:
      "Cette analyse repose sur un contexte limité; le rapport évite les affirmations excessives et se concentre sur la prochaine étape la plus prudente.",
    valueTitle: "Le rapport complet vous apporte :",
    valueBullets: [
      "Une recommandation claire",
      "Pourquoi il faut être prudent",
      "Ce qui peut se passer si vous poursuivez",
      "Ce que les fraudeurs peuvent chercher à obtenir",
      "Que faire si vous avez déjà cliqué ou partagé des informations",
      "Un lien de rapport sécurisé à envoyer à une autre personne",
    ],
    useTitle: "Vous pouvez l’utiliser pour :",
    useBullets: [
      "décider quoi faire ensuite",
      "expliquer la situation à quelqu’un d’autre",
      "l’envoyer à un collègue, à la TI, à l’assistance ou à un proche",
      "conserver une trace horodatée de l’analyse",
    ],
    previewTitle: "Exemple tiré de votre rapport",
    videoTitle: "Explication d’une minute",
    videoBody:
      "Gabriel de ScanScam explique comment lire ce rapport et quoi faire avant d’agir.",
    videoSoon: "Vidéo à venir",
    ctaUnlock: "Déverrouiller le rapport complet — 5 $",
    ctaBetaNote:
      "Accès bêta : aujourd’hui, vous pouvez le déverrouiller gratuitement en répondant à 4 courtes questions.",
    trustNote: "Aucun compte requis. Lien de rapport sécurisé valide 21 jours.",
    backResult: "Retour au résultat",
    backScan: "Retour à l’analyse",
    hero: {
      link: "Obtenez une réponse plus claire avant de cliquer",
      full_message: "Comprendre ce que ce message peut chercher à faire",
      insufficient: "Transformez cette analyse en rapport décisionnel plus clair",
    },
    previewLine1: {
      link: "Action recommandée : traitez ce lien comme non fiable tant qu’il n’est pas vérifié par une source officielle.",
      full_message:
        "Action recommandée : ne répondez pas tant que le message n’est pas vérifié par une source officielle.",
      insufficient:
        "Action recommandée : n’agissez pas tant que la source et l’action demandée ne sont pas vérifiées.",
    },
    previewLine2: {
      link: "Pourquoi : l’analyse a détecté un domaine récemment enregistré et un contexte limité.",
      full_message:
        "Pourquoi : l’analyse a détecté des schémas souvent utilisés pour créer de l’urgence ou de la pression.",
      insufficient:
        "Pourquoi : l’analyse a relevé des signaux de prudence, mais pas assez de contexte pour confirmer la situation complète.",
    },
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

  const t = copy[lang];

  const intent = useMemo(() => {
    if (!telemetry) return "link" as SalesIntentBucket;
    return getSalesIntentFromParams({
      input_type: telemetry.input_type,
      intel_state: telemetry.intel_state,
      reason,
    });
  }, [telemetry, reason]);

  const showLimitedContextNote =
    intent === "insufficient" ||
    telemetry?.intel_state.trim().toLowerCase() === "insufficient_context" ||
    reason === "insufficient_context";

  const showThreatRow = telemetry?.web_risk_status.trim().toLowerCase() === "unsafe";

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
    <main className="mx-auto max-w-xl px-4 py-10 text-gray-900">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ScanScam</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{t.hero[intent]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.emotionalSubtitle}</p>
      </header>

      <section
        className="mt-8 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4"
        aria-labelledby="context-summary"
      >
        <h2 id="context-summary" className="text-sm font-semibold text-slate-900">
          {t.contextTitle}
        </h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-800">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-slate-600">{t.riskLevel}</dt>
            <dd>{displayRiskTier(lang, telemetry.risk_tier)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-slate-600">{t.linkType}</dt>
            <dd>{displayLinkType(lang, telemetry.link_type)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-slate-600">{t.domainSignal}</dt>
            <dd>{displayDomainSignal(lang, telemetry.domain_signal)}</dd>
          </div>
          {showThreatRow ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-slate-600">{t.threatDb}</dt>
              <dd>{t.threatDbUnsafe}</dd>
            </div>
          ) : null}
        </dl>
        {showLimitedContextNote ? (
          <p className="mt-4 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-700">
            {t.limitedContextNote}
          </p>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="value-prop">
        <h2 id="value-prop" className="text-base font-semibold text-slate-900">
          {t.valueTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {t.valueBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="use-cases">
        <h2 id="use-cases" className="text-base font-semibold text-slate-900">
          {t.useTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {t.useBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section
        className="mt-8 rounded-lg border border-slate-200 bg-white px-4 py-4"
        aria-labelledby="preview"
      >
        <h2 id="preview" className="text-base font-semibold text-slate-900">
          {t.previewTitle}
        </h2>
        <p className="mt-3 rounded-md border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-sm font-medium leading-snug text-slate-800">
          {t.previewLine1[intent]}
        </p>
        <p className="mt-2 rounded-md border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
          {t.previewLine2[intent]}
        </p>
      </section>

      <section
        className="mt-8 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4"
        aria-labelledby="video-explainer"
      >
        <h2 id="video-explainer" className="text-base font-semibold text-slate-900">
          {t.videoTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.videoBody}</p>
        <button
          type="button"
          disabled
          className="mt-3 cursor-not-allowed rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-400"
        >
          {t.videoSoon}
        </button>
      </section>

      <section className="mt-10" aria-label="Purchase">
        <button
          type="button"
          onClick={onUnlock}
          className="w-full rounded-lg bg-amber-800 px-4 py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        >
          {t.ctaUnlock}
        </button>
        <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">{t.ctaBetaNote}</p>
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">{t.trustNote}</p>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-8">
        <a
          href={backHref}
          className="text-sm font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
        >
          {scanId.length > 0 ? t.backResult : t.backScan}
        </a>
      </footer>
    </main>
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
