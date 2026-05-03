"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyReportLinkButton } from "@/components/CopyReportLinkButton";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import type { ReportTelemetryFromIntel } from "@/lib/proReports/intelReportModel";

export type DecisionReportTelemetry = ReportTelemetryFromIntel;

export type DecisionReportProps = {
  lang: "en" | "fr";
  scanId: string;
  analyzedDomain: string;
  telemetry: DecisionReportTelemetry;
  /** When the report was generated (client clock for /pro, scan/access time for /r). */
  generatedAtMs: number;
  reportExpiresAtMs?: number | null;
  /** When set, secure share block + share sections use this token. */
  shareToken?: string | null;
  /** Precomputed absolute report URL (server); else client uses NEXT_PUBLIC_APP_URL or window.location.origin. */
  reportAbsoluteUrl?: string | null;
  partnerSlug?: string | null;
  /** Fire `pro_preview_viewed` once per session when true (preview flow only). */
  logProPreviewViewed?: boolean;
  ctaReasonForTelemetry?: string;
};

const copy = {
  en: {
    reportTitle: "ScanScam Decision Report",
    reportSubtitle: "Security triage output",
    reportFramingLine:
      "This report is generated from a specific scan and can be shared securely for review or verification.",
    reportGeneratedLabel: "Report generated",
    scanIdLabel: "Scan ID",
    secureReportLinkTitle: "Secure report link",
    secureReportLinkBody: "This report is hosted on a private, time-limited link.",
    secureReportLinkInstruction:
      "Share this page or copy the link below to send it to someone you trust.",
    secureShareAfterUnlock: "Secure report link is generated after unlock.",
    secureShareExpiresPrefix: "Link valid until",
    analyzedLinkTitle: "Analyzed link",
    analyzedDomainLabel: "Domain",
    analyzedSourceLabel: "Source",
    analyzedSourceValue: "User-submitted scan",
    analyzedUnavailable: "Submitted link details unavailable in this preview",
    recommendedTitle: "Recommended action",
    recPrimaryUnsafe: "Do not interact with this link.",
    recPrimaryUntrusted:
      "Treat this link as untrusted until verified through an official source.",
    recPrimaryInsufficient:
      "ScanScam has limited context, but the detected signals justify caution.",
    recPrimaryVerify: "Proceed only after verifying the source independently.",
    recUnderMain: "Acting on unverified links is one of the most common entry points for scams.",
    recSecondary:
      "If this link was unexpected, it should not be trusted without independent verification.",
    confidenceLabel: "Confidence",
    confidenceLimited: "limited",
    confidenceModerate: "moderate",
    howAnalyzedTitle: "How this was analyzed",
    howAnalyzedIntro: "This report combines several signals instead of relying on a single check.",
    howAnalyzedBullets: [
      "Link structure and destination pattern",
      "Domain registration signal",
      "External threat database result when available",
      "Behavioral patterns observed in similar submissions",
    ],
    riskyTitle: "What makes this risky",
    riskyIntro: "This link combines signals that increase uncertainty:",
    riskyBulletRecent: "Recently registered domain",
    riskyBulletShortened: "Shortened or unusual link pattern",
    riskyBulletLimited: "Limited surrounding context",
    riskyBulletThreat: "External threat database flag",
    riskyBulletDestination:
      "Destination not independently verified in this report",
    riskyClosing:
      "Together, these signals mean the link should not be trusted without independent verification.",
    signalsTitle: "Signals detected",
    signalsNone:
      "No signal summary was included in the link. The guidance below still applies when you need to decide how to respond.",
    labelRisk: "Risk level",
    labelLinkType: "Link type",
    labelDomainSignal: "Domain signal",
    labelThreatDb: "Threat database",
    threatDbUnsafeLine: "Flagged in threat database",
    riskTier: { low: "Low", medium: "Medium", high: "High" } as Record<string, string>,
    linkType: {
      shortened: "Shortened",
      unusual: "Unusual",
      standard: "Standard",
    } as Record<string, string>,
    domainSignal: {
      recent: "Recently registered domain",
      established: "Established domain",
      mid: "Mid-age domain",
      unavailable: "Unavailable",
    } as Record<string, string>,
    whyConfidenceTitle: "Why confidence is limited",
    whyConfidenceBody1:
      "This submission contains limited surrounding context. A link by itself can show infrastructure signals, but it may not reveal who sent it, what they asked for, or what action they wanted you to take.",
    whyConfidenceBody2: "ScanScam avoids over-interpreting incomplete inputs.",
    doLinkTitle: "What to do with this link",
    doLinkBullets: [
      "Do not click the link directly",
      "Go to the official website manually",
      "Verify through a trusted channel before taking action",
    ],
    alreadyTitle: "If you already interacted with this link",
    alreadyBullets: [
      "If you clicked only: close the page and avoid entering information",
      "If you entered a password or code: change it immediately through the official site",
      "If you paid or shared banking details: contact your bank or provider right away",
      "If this was work-related: send this report to IT or security",
    ],
    shareTitle: "Share this report",
    shareText:
      "Use this report to explain the risk clearly to someone else — a family member, colleague, IT provider, or support contact.",
    shareUseLinkAbove: "Use the private link at the top of this page if you want to share this report.",
    videoPlaceholder: "1-minute explanation video coming soon",
    reportFeedbackTitle: "Was this report useful?",
    feedbackYes: "Yes",
    feedbackNo: "No",
    feedbackHelpedLabel: "What helped most?",
    feedbackMissingLabel: "What was missing?",
    worthTitle: "Would this have felt worth $5?",
    worthYes: "Yes",
    worthNotYet: "Not yet",
    worthMaybe: "Maybe, with more detail",
    feedbackSend: "Send feedback",
    feedbackThanks: "Thank you for your feedback.",
    feedbackPrivacy:
      "Please do not include sensitive personal information such as passwords, banking details, verification codes, or government ID numbers.",
    feedbackError: "Could not send feedback. Please try again.",
    back: "Back to result",
    backScan: "Back to scanner",
  },
  fr: {
    reportTitle: "Rapport décisionnel ScanScam",
    reportSubtitle: "Sortie de triage sécurité",
    reportFramingLine:
      "Ce rapport est généré à partir d’une analyse précise et peut être partagé en toute sécurité pour examen ou vérification.",
    reportGeneratedLabel: "Rapport généré",
    scanIdLabel: "ID d’analyse",
    secureReportLinkTitle: "Lien de rapport sécurisé",
    secureReportLinkBody: "Ce rapport est disponible via un lien privé et d’une durée limitée.",
    secureReportLinkInstruction:
      "Partagez cette page ou copiez le lien ci-dessous pour l’envoyer à une personne de confiance.",
    secureShareAfterUnlock: "Le lien de rapport sécurisé est généré après le déverrouillage.",
    secureShareExpiresPrefix: "Lien valide jusqu’au",
    analyzedLinkTitle: "Lien analysé",
    analyzedDomainLabel: "Domaine",
    analyzedSourceLabel: "Source",
    analyzedSourceValue: "Analyse soumise par l’utilisateur",
    analyzedUnavailable: "Détails du lien indisponibles dans cet aperçu",
    recommendedTitle: "Action recommandée",
    recPrimaryUnsafe: "N’interagissez pas avec ce lien.",
    recPrimaryUntrusted:
      "Traitez ce lien comme non fiable tant qu’il n’est pas vérifié par une source officielle.",
    recPrimaryInsufficient:
      "ScanScam dispose d’un contexte limité, mais les signaux détectés justifient la prudence.",
    recPrimaryVerify: "Ne poursuivez qu’après avoir vérifié la source de façon indépendante.",
    recUnderMain:
      "Agir sur la base de liens non vérifiés est l’une des portes d’entrée les plus fréquentes des arnaques.",
    recSecondary:
      "Si ce lien était inattendu, il ne doit pas être considéré comme fiable sans vérification indépendante.",
    confidenceLabel: "Confiance",
    confidenceLimited: "limitée",
    confidenceModerate: "modérée",
    howAnalyzedTitle: "Comment cela a été analysé",
    howAnalyzedIntro:
      "Ce rapport combine plusieurs signaux plutôt que de s’appuyer sur une seule vérification.",
    howAnalyzedBullets: [
      "Structure du lien et schéma de destination",
      "Signal d’enregistrement du domaine",
      "Résultat de la base de menaces externe lorsque disponible",
      "Schémas comportementaux observés dans des soumissions comparables",
    ],
    riskyTitle: "Ce qui rend ce lien risqué",
    riskyIntro: "Ce lien combine des signaux qui augmentent l’incertitude :",
    riskyBulletRecent: "Domaine récemment enregistré",
    riskyBulletShortened: "Lien raccourci ou schéma inhabituel",
    riskyBulletLimited: "Contexte environnant limité",
    riskyBulletThreat: "Signalement par la base de menaces externe",
    riskyBulletDestination:
      "Destination non vérifiée de façon indépendante dans ce rapport",
    riskyClosing:
      "Ensemble, ces signaux signifient que le lien ne doit pas être considéré comme fiable sans vérification indépendante.",
    signalsTitle: "Signaux détectés",
    signalsNone:
      "Aucun résumé de signaux n’a été transmis dans le lien. Les conseils ci-dessous restent utiles pour décider comment réagir.",
    labelRisk: "Niveau de risque",
    labelLinkType: "Type de lien",
    labelDomainSignal: "Signal du domaine",
    labelThreatDb: "Base de menaces",
    threatDbUnsafeLine: "Signalée dans la base de menaces",
    riskTier: { low: "Faible", medium: "Moyen", high: "Élevé" } as Record<string, string>,
    linkType: {
      shortened: "Raccourci",
      unusual: "Inhabituel",
      standard: "Courant",
    } as Record<string, string>,
    domainSignal: {
      recent: "Domaine récent",
      established: "Domaine établi",
      mid: "Domaine d’âge intermédiaire",
      unavailable: "Indisponible",
    } as Record<string, string>,
    whyConfidenceTitle: "Pourquoi la confiance est limitée",
    whyConfidenceBody1:
      "Cette soumission comporte peu de contexte autour du lien. Un lien seul peut montrer des signaux d’infrastructure, mais il peut ne pas révéler l’expéditeur, la demande ou l’action souhaitée.",
    whyConfidenceBody2: "ScanScam évite de sur-interpréter les entrées incomplètes.",
    doLinkTitle: "Que faire avec ce lien",
    doLinkBullets: [
      "Ne cliquez pas directement sur le lien",
      "Ouvrez le site officiel manuellement",
      "Vérifiez par un canal de confiance avant d’agir",
    ],
    alreadyTitle: "Si vous avez déjà interagi avec ce lien",
    alreadyBullets: [
      "Si vous avez seulement cliqué : fermez la page et évitez de saisir quoi que ce soit",
      "Si vous avez entré un mot de passe ou un code : modifiez-le tout de suite via le site officiel",
      "Si vous avez payé ou communiqué des données bancaires : contactez immédiatement votre banque ou fournisseur",
      "Si c’était lié au travail : envoyez ce rapport à la TI ou à la sécurité",
    ],
    shareTitle: "Partager ce rapport",
    shareText:
      "Servez-vous de ce rapport pour expliquer clairement le risque à une autre personne — un proche, un collègue, un fournisseur TI ou un contact d’assistance.",
    shareUseLinkAbove:
      "Utilisez le lien privé en haut de cette page si vous souhaitez partager ce rapport.",
    videoPlaceholder: "Vidéo d’explication d’une minute — bientôt disponible",
    reportFeedbackTitle: "Ce rapport vous a-t-il été utile ?",
    feedbackYes: "Oui",
    feedbackNo: "Non",
    feedbackHelpedLabel: "Qu’est-ce qui vous a le plus aidé ?",
    feedbackMissingLabel: "Qu’est-ce qui manquait ?",
    worthTitle: "Cela aurait-il valu 5 $ pour vous ?",
    worthYes: "Oui",
    worthNotYet: "Pas encore",
    worthMaybe: "Peut-être, avec plus de détails",
    feedbackSend: "Envoyer les commentaires",
    feedbackThanks: "Merci pour vos commentaires.",
    feedbackPrivacy:
      "Veuillez ne pas inclure d’informations personnelles sensibles telles que mots de passe, données bancaires, codes de vérification ou numéros d’identité gouvernementaux.",
    feedbackError: "Envoi impossible. Veuillez réessayer.",
    back: "Retour au résultat",
    backScan: "Retour à l’analyse",
  },
} as const;

type Lang = "en" | "fr";
type WorthFiveChoice = "yes" | "not_yet" | "maybe_more_detail";

function shortenScanId(id: string): string {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function mapOrPassThrough(table: Record<string, string>, raw: string, _lang: Lang): string {
  const k = raw.trim().toLowerCase();
  if (!k) return "";
  if (table[k]) return table[k];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildSignalItems(
  lang: Lang,
  tel: DecisionReportTelemetry
): { label: string; value: string }[] {
  const t = copy[lang];
  const out: { label: string; value: string }[] = [];

  const risk = mapOrPassThrough(t.riskTier as Record<string, string>, tel.risk_tier, lang);
  if (risk) out.push({ label: t.labelRisk, value: risk });

  const lt = mapOrPassThrough(t.linkType as Record<string, string>, tel.link_type, lang);
  if (lt) out.push({ label: t.labelLinkType, value: lt });

  const dom = mapOrPassThrough(t.domainSignal as Record<string, string>, tel.domain_signal, lang);
  if (dom) out.push({ label: t.labelDomainSignal, value: dom });

  if (tel.web_risk_status.trim().toLowerCase() === "unsafe") {
    out.push({ label: t.labelThreatDb, value: t.threatDbUnsafeLine });
  }

  return out;
}

function resolveRecommendedPrimary(lang: Lang, tel: DecisionReportTelemetry): string {
  const t = copy[lang];
  const web = tel.web_risk_status.trim().toLowerCase();
  const domain = tel.domain_signal.trim().toLowerCase();
  const risk = tel.risk_tier.trim().toLowerCase();
  const intel = tel.intel_state.trim().toLowerCase();

  if (web === "unsafe") return t.recPrimaryUnsafe;

  if (domain === "recent" || risk === "medium" || risk === "high") return t.recPrimaryUntrusted;

  if (intel === "insufficient_context") return t.recPrimaryInsufficient;

  return t.recPrimaryVerify;
}

function resolveConfidence(tel: DecisionReportTelemetry): "limited" | "moderate" {
  const intel = tel.intel_state.trim().toLowerCase();
  const cq = tel.context_quality.trim().toLowerCase();

  if (intel === "insufficient_context" || cq === "fragment") {
    return "limited";
  }
  return "moderate";
}

function confidenceDisplay(lang: Lang, level: "limited" | "moderate"): string {
  const t = copy[lang];
  const word = level === "limited" ? t.confidenceLimited : t.confidenceModerate;
  return `${t.confidenceLabel}: ${word}`;
}

function showWhyConfidenceLimited(tel: DecisionReportTelemetry): boolean {
  const intel = tel.intel_state.trim().toLowerCase();
  const cq = tel.context_quality.trim().toLowerCase();
  const input = tel.input_type.trim().toLowerCase();
  return intel === "insufficient_context" || cq === "fragment" || input === "link_only";
}

function buildRiskyBullets(lang: Lang, tel: DecisionReportTelemetry): string[] {
  const t = copy[lang];
  const out: string[] = [];
  const domSig = tel.domain_signal.trim().toLowerCase();
  const lt = tel.link_type.trim().toLowerCase();
  const intel = tel.intel_state.trim().toLowerCase();
  const cq = tel.context_quality.trim().toLowerCase();
  const web = tel.web_risk_status.trim().toLowerCase();

  if (domSig === "recent") out.push(t.riskyBulletRecent);
  if (lt === "shortened" || lt === "unusual") out.push(t.riskyBulletShortened);
  if (cq === "fragment" || intel === "insufficient_context") out.push(t.riskyBulletLimited);
  if (web === "unsafe") out.push(t.riskyBulletThreat);
  out.push(t.riskyBulletDestination);
  return out;
}

export function DecisionReport({
  lang,
  scanId,
  analyzedDomain,
  telemetry,
  generatedAtMs,
  reportExpiresAtMs,
  shareToken,
  reportAbsoluteUrl,
  partnerSlug,
  logProPreviewViewed,
  ctaReasonForTelemetry,
}: DecisionReportProps) {
  const t = copy[lang];
  const [mounted, setMounted] = useState(false);
  const [reportUseful, setReportUseful] = useState<boolean | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [worthFive, setWorthFive] = useState<WorthFiveChoice | "">("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [resolvedReportUrl, setResolvedReportUrl] = useState<string | null>(() => {
    const fromServer = reportAbsoluteUrl?.trim();
    if (fromServer) return fromServer;
    const tok = shareToken?.trim() ?? "";
    if (!tok) return null;
    const pub =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, "")
        : "";
    if (pub) return `${pub}/r/${encodeURIComponent(tok)}`;
    return null;
  });

  useEffect(() => {
    const tok = shareToken?.trim() ?? "";
    if (!tok) {
      setResolvedReportUrl(null);
      return;
    }
    const server = reportAbsoluteUrl?.trim();
    if (server) {
      setResolvedReportUrl(server);
      return;
    }
    const pub =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, "")
        : "";
    if (pub) {
      setResolvedReportUrl(`${pub}/r/${encodeURIComponent(tok)}`);
      return;
    }
    if (typeof window !== "undefined") {
      setResolvedReportUrl(`${window.location.origin}/r/${encodeURIComponent(tok)}`);
      return;
    }
    setResolvedReportUrl(`/r/${encodeURIComponent(tok)}`);
  }, [shareToken, reportAbsoluteUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tokenForFeedback = shareToken?.trim() ?? "";
  useEffect(() => {
    if (!tokenForFeedback) return;
    try {
      const k = `ss_report_feedback_sent:${tokenForFeedback.slice(0, 24)}`;
      if (sessionStorage.getItem(k)) setFeedbackDone(true);
    } catch {
      /* ignore */
    }
  }, [tokenForFeedback]);

  const signalItems = useMemo(() => buildSignalItems(lang, telemetry), [lang, telemetry]);

  const recommendedPrimary = useMemo(() => resolveRecommendedPrimary(lang, telemetry), [lang, telemetry]);

  const riskyBullets = useMemo(() => buildRiskyBullets(lang, telemetry), [lang, telemetry]);

  const showWhyLimited = useMemo(() => showWhyConfidenceLimited(telemetry), [telemetry]);

  useEffect(() => {
    if (!mounted || !logProPreviewViewed || !scanId) return;
    const key = `ss_pro_preview_viewed:${scanId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const props: Record<string, string> = {
      variant: "A",
      cta_reason: ctaReasonForTelemetry || "unknown",
    };
    const add = (k: keyof DecisionReportTelemetry) => {
      const v = telemetry[k];
      if (typeof v === "string" && v.length > 0) props[k] = v;
    };
    add("risk_tier");
    add("input_type");
    add("intel_state");
    add("context_quality");
    add("web_risk_status");
    add("link_type");
    add("domain_signal");
    logScanEvent("pro_preview_viewed", {
      scan_id: scanId,
      props,
    });
  }, [mounted, logProPreviewViewed, scanId, ctaReasonForTelemetry, telemetry]);

  const backHref =
    scanId.length > 0
      ? `/result/${encodeURIComponent(scanId)}?lang=${lang}${partnerSlug ? `&partner=${encodeURIComponent(partnerSlug)}` : ""}`
      : `/scan?lang=${lang}`;

  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const generatedAt = new Date(generatedAtMs);
  const generatedStr = Number.isNaN(generatedAt.getTime())
    ? "—"
    : generatedAt.toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      });

  const expiresStr =
    reportExpiresAtMs != null && reportExpiresAtMs > 0
      ? new Date(reportExpiresAtMs).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  const confidenceTier = resolveConfidence(telemetry);

  const sendReportFeedback = async () => {
    if (reportUseful === null || !tokenForFeedback) return;
    setFeedbackSending(true);
    setFeedbackError(null);
    try {
      const res = await fetch("/api/pro-report/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenForFeedback,
          useful: reportUseful,
          feedback_text: feedbackText.trim() || undefined,
          worth_five: worthFive || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFeedbackError(t.feedbackError);
        setFeedbackSending(false);
        return;
      }
      try {
        sessionStorage.setItem(`ss_report_feedback_sent:${tokenForFeedback.slice(0, 24)}`, "1");
      } catch {
        /* ignore */
      }
      setFeedbackDone(true);
      logScanEvent("report_feedback_submitted", {
        scan_id: scanId || undefined,
        props: {
          flow: "shared_report",
          report_useful: reportUseful ? "yes" : "no",
          ...(worthFive ? { worth_five: worthFive } : {}),
        },
      });
    } catch {
      setFeedbackError(t.feedbackError);
    }
    setFeedbackSending(false);
  };

  const choiceBtn =
    "rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

  const token = tokenForFeedback;
  const relativeReportPath = token ? `/r/${encodeURIComponent(token)}` : "";
  const displayReportUrl = (resolvedReportUrl?.trim() || relativeReportPath).trim();

  return (
    <article className="mx-auto max-w-xl px-4 py-10 text-gray-900">
      <header className="border-b-2 border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ScanScam</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{t.reportTitle}</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">{t.reportSubtitle}</p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-600">{t.reportFramingLine}</p>
        <dl className="mt-5 space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-slate-800">{t.reportGeneratedLabel}</dt>
            <dd>{generatedStr}</dd>
          </div>
          {scanId ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-800">{t.scanIdLabel}</dt>
              <dd className="font-mono text-xs text-slate-600 sm:text-sm">{shortenScanId(scanId)}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {token ? (
        <section
          className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3.5"
          aria-labelledby="secure-report-link"
        >
          <h2 id="secure-report-link" className="text-sm font-semibold text-slate-900">
            {t.secureReportLinkTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.secureReportLinkBody}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.secureReportLinkInstruction}</p>
          {displayReportUrl ? (
            <p className="mt-3 break-all font-mono text-xs leading-relaxed text-slate-800 sm:text-sm">
              <a
                href={displayReportUrl}
                className="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
              >
                {displayReportUrl}
              </a>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {displayReportUrl ? <CopyReportLinkButton reportUrl={displayReportUrl} lang={lang} /> : null}
          </div>
          {expiresStr ? (
            <p className="mt-3 text-xs text-slate-600">
              {t.secureShareExpiresPrefix} {expiresStr}
            </p>
          ) : null}
        </section>
      ) : (
        <section
          className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600"
          aria-label={t.secureShareAfterUnlock}
        >
          {t.secureShareAfterUnlock}
        </section>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3" aria-labelledby="analyzed-link">
        <h2 id="analyzed-link" className="text-sm font-bold uppercase tracking-wide text-slate-900">
          {t.analyzedLinkTitle}
        </h2>
        {analyzedDomain ? (
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              <dt className="inline font-semibold text-slate-800">{t.analyzedDomainLabel}: </dt>
              <dd className="inline font-mono text-slate-900">{analyzedDomain}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-800">{t.analyzedSourceLabel}: </dt>
              <dd className="inline text-slate-700">{t.analyzedSourceValue}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.analyzedUnavailable}</p>
        )}
      </section>

      <section
        className="mt-8 rounded-lg border-2 border-slate-800 bg-slate-50 px-4 py-4"
        aria-labelledby="recommended-action"
      >
        <h2 id="recommended-action" className="text-sm font-bold uppercase tracking-wide text-slate-900">
          {t.recommendedTitle}
        </h2>
        <p className="mt-3 text-base font-semibold leading-snug text-slate-900">{recommendedPrimary}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.recUnderMain}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.recSecondary}</p>
        <p className="mt-3 text-sm text-slate-600">{confidenceDisplay(lang, confidenceTier)}</p>
      </section>

      <section className="mt-8" aria-labelledby="how-analyzed">
        <h2 id="how-analyzed" className="text-base font-bold text-slate-900">
          {t.howAnalyzedTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.howAnalyzedIntro}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {t.howAnalyzedBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="what-risky">
        <h2 id="what-risky" className="text-base font-bold text-slate-900">
          {t.riskyTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.riskyIntro}</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {riskyBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-800">{t.riskyClosing}</p>
      </section>

      <section className="mt-8" aria-labelledby="signals">
        <h2 id="signals" className="text-base font-bold text-slate-900">
          {t.signalsTitle}
        </h2>
        {signalItems.length > 0 ? (
          <ul className="mt-3 list-none space-y-1.5 text-sm text-slate-700">
            {signalItems.map((row) => (
              <li key={`${row.label}-${row.value}`} className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  <span className="font-semibold text-slate-800">{row.label}:</span> {row.value}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.signalsNone}</p>
        )}
      </section>

      {showWhyLimited ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3" aria-labelledby="why-confidence">
          <h2 id="why-confidence" className="text-base font-bold text-slate-900">
            {t.whyConfidenceTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.whyConfidenceBody1}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.whyConfidenceBody2}</p>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="do-link">
        <h2 id="do-link" className="text-base font-bold text-slate-900">
          {t.doLinkTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {t.doLinkBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section
        className="mt-8 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-4"
        aria-labelledby="already-acted"
      >
        <h2 id="already-acted" className="text-base font-bold text-slate-900">
          {t.alreadyTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-relaxed text-slate-800">
          {t.alreadyBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section
        className="mt-8 rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-4"
        aria-labelledby="share-report"
      >
        <h2 id="share-report" className="text-base font-bold text-slate-900">
          {t.shareTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.shareText}</p>
        {token ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.shareUseLinkAbove}</p>
        ) : (
          <p className="mt-2 text-sm font-medium text-slate-600">{t.secureShareAfterUnlock}</p>
        )}
      </section>

      <section
        className="mt-6 rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-center"
        aria-label={t.videoPlaceholder}
      >
        <p className="text-xs font-medium text-slate-500">{t.videoPlaceholder}</p>
      </section>

      {token ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white/60 px-4 py-4" aria-labelledby="feedback">
          <h2 id="feedback" className="text-sm font-semibold text-slate-800">
            {t.reportFeedbackTitle}
          </h2>
          {feedbackDone ? (
            <p className="mt-3 text-sm text-slate-700">{t.feedbackThanks}</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportUseful(true);
                    setFeedbackError(null);
                  }}
                  className={`${choiceBtn} ${
                    reportUseful === true
                      ? "border-slate-600 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  {t.feedbackYes}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportUseful(false);
                    setFeedbackError(null);
                  }}
                  className={`${choiceBtn} ${
                    reportUseful === false
                      ? "border-slate-600 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  {t.feedbackNo}
                </button>
              </div>
              {reportUseful !== null ? (
                <div className="mt-4 space-y-4">
                  <label className="block text-sm text-slate-800">
                    <span className="font-medium">
                      {reportUseful ? t.feedbackHelpedLabel : t.feedbackMissingLabel}
                    </span>
                    <textarea
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.feedbackPrivacy}</p>
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-800">{t.worthTitle}</legend>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="worth5"
                        checked={worthFive === "yes"}
                        onChange={() => setWorthFive("yes")}
                      />
                      {t.worthYes}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="worth5"
                        checked={worthFive === "not_yet"}
                        onChange={() => setWorthFive("not_yet")}
                      />
                      {t.worthNotYet}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="worth5"
                        checked={worthFive === "maybe_more_detail"}
                        onChange={() => setWorthFive("maybe_more_detail")}
                      />
                      {t.worthMaybe}
                    </label>
                  </fieldset>
                  {feedbackError ? (
                    <p className="text-sm font-medium text-red-700">{feedbackError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendReportFeedback()}
                    disabled={feedbackSending}
                    className="rounded-md border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {t.feedbackSend}
                  </button>
                  <p className="text-xs leading-relaxed text-slate-500">{t.feedbackPrivacy}</p>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <footer className="mt-10 border-t border-slate-200 pt-8">
        <a
          href={backHref}
          className="text-sm font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
        >
          {scanId.length > 0 ? t.back : t.backScan}
        </a>
      </footer>
    </article>
  );
}
