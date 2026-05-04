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
    reportSubtitle: "Clear next-step guidance from your scan",
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
    signalsTitle: "Signals detected",
    signalsNone:
      "No signal summary was included in the link. The guidance below still applies when you need to decide how to respond.",
    labelRisk: "Risk level",
    labelLinkType: "Link type",
    labelDomainSignal: "Domain signal",
    labelThreatDb: "Threat database",
    threatDbUnsafeLine: "Flagged in threat database",
    signalWebRiskLabel: "External threat check",
    webRiskCleanValue: "No known unsafe match",
    webRiskUnknownValue: "Check unavailable",
    linkExplainStandard:
      "Standard link — The link does not appear shortened, disguised, or unusually formatted.",
    linkExplainShortened: "Shortened link — Shortened links can hide the final destination.",
    linkExplainUnusual: "Unusual link — The link structure may deserve extra caution.",
    domainAgeContextNote:
      "Older domains are not automatically safe, but newly created domains are often a stronger warning sign.",
    domainExplainRecentCoarse:
      "Recently registered domain — This domain appears newly created from the available registration data.",
    domainExplainMidCoarse:
      "Mid-age domain — The domain has been registered for some time based on available registration data.",
    domainExplainEstablishedCoarse:
      "Established domain — The domain does not appear newly created from the available registration data.",
    domainExplainUnavailable:
      "Domain registration — Registration timing could not be confirmed from available data.",
    webRiskCleanDetail:
      "No known unsafe match found — No match was found in the external threat database used for this scan.",
    webRiskUnsafeDetail:
      "Unsafe match found — The link matched an external threat database and should not be used.",
    webRiskUnavailableDetail:
      "Threat database check unavailable — ScanScam could not confirm this signal for this scan.",
    linkBasedChecksLabel: "Link-based checks",
    linkBasedChecksNAValue: "Not applicable",
    linkBasedChecksNADetail:
      "No usable link was found in the submitted message, so link, domain, and external threat checks were not run for this scan.",
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
      "This report is based on the information submitted. A link by itself can show infrastructure signals, but it may not reveal who sent it, what they asked for, or what action they wanted you to take.",
    whyConfidenceBody2: "ScanScam avoids over-interpreting incomplete inputs.",
    limitsTitle: "Important limits",
    limitsBody:
      "ScanScam helps you understand suspicious messages and choose a safer next step. It does not guarantee that a message is safe or fraudulent, and it is not legal, financial, or technical remediation advice. When in doubt, verify through the official source.",
    shareTitle: "Share or keep this report",
    shareText:
      "Use this report as a clear, time-stamped summary you can keep or send to someone you trust, a family member, workplace support, a bank, or a service provider.",
    shareUseLinkAbove: "Use the private link at the top of this page if you want to share this report.",
    reportFeedbackTitle: "Was this report useful?",
    feedbackYes: "Yes",
    feedbackSomewhat: "Somewhat",
    feedbackNo: "No",
    feedbackHelpedLabel: "What helped most?",
    feedbackMissingLabel: "What was missing?",
    feedbackSend: "Send feedback",
    feedbackThanks: "Thank you for your feedback.",
    feedbackPrivacy:
      "Please do not include sensitive personal information such as passwords, banking details, verification codes, or government ID numbers.",
    feedbackError: "Could not send feedback. Please try again.",
    back: "Back to result",
    backScan: "Back to scanner",
    tier: {
      low: {
        recPrimary: "No strong warning signs were found from the information submitted.",
        recSupporting:
          "This result appears low risk based on the available signals. If this message was unexpected, verify through the official source before acting.",
        riskTitle: "What this result means",
        riskBody: [
          "This scan did not find strong warning signs in the submitted information.",
          "A low-risk result applies only to this specific scan. A link or short message may not show the full message, sender, or request, so ScanScam avoids over-interpreting incomplete inputs.",
        ],
        doTitle: "What to watch for next",
        doIntro:
          "This scan looks low risk based on what was submitted. Review the situation again if a new message or follow-up asks you to take action, share information, pay money, enter a code, or respond under pressure.",
        doBullets: [
          "A request for money, passwords, codes, banking details, or personal information",
          "Pressure to act quickly",
          "A sender you cannot verify",
          "A message that does not match what you expected",
          "Repeated or unusual messages, especially in a work context",
        ],
        doClosing:
          "If this is work-related or part of repeated unusual messages, send the report to IT or someone who can review the broader context.",
        escTitle: "",
        escIntro: null,
        escBullets: [],
      },
      medium: {
        recPrimary: "Do not act until the source and requested action are verified.",
        recSupporting:
          "ScanScam found cautionary signals. The safest next step is to verify through the official source before clicking, replying, paying, or sharing more information.",
        riskTitle: "Why this deserves attention",
        riskBody: ["This scan found cautionary signals that deserve attention before you act."],
        doTitle: "What to do before acting",
        doBullets: [
          "Do not use the link until the source is verified.",
          "Go to the official website manually.",
          "Verify through a trusted channel before clicking, replying, paying, or sharing information.",
        ],
        doIntro: null,
        doClosing: null,
        escTitle: "If you already interacted",
        escIntro: null,
        escBullets: [
          "Stop further action for now.",
          "If you entered a password or code, change it through the official site.",
          "If you paid or shared banking details, contact your bank or provider.",
          "If this was work-related, send this report to IT or your support contact.",
        ],
      },
      high: {
        recPrimary:
          "Do not click, reply, pay, or share more information until this is verified through an official source.",
        recSupporting:
          "ScanScam found stronger warning signs that may indicate suspicious intent, pressure, or a request to act.",
        riskTitle: "What triggered the risk",
        riskBody: ["This scan found stronger warning signs that should be verified before any further action."],
        doTitle: "What to do now",
        doBullets: [
          "Do not click, reply, pay, or share more information.",
          "Do not enter passwords, codes, banking details, or personal information.",
          "Verify through the official website, provider, bank, workplace support, or another trusted channel.",
        ],
        doIntro: null,
        doClosing: null,
        escTitle: "If you already interacted",
        escIntro: null,
        escBullets: [
          "Stop further action.",
          "If you entered a password or code, change it immediately through the official site.",
          "If you paid or shared banking details, contact your bank or provider right away.",
          "If this was work-related, send this report to IT or security.",
        ],
      },
    },
  },
  fr: {
    reportTitle: "Rapport décisionnel ScanScam",
    reportSubtitle: "Des indications claires pour la suite à partir de votre scan",
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
    signalsTitle: "Signaux détectés",
    signalsNone:
      "Aucun résumé de signaux n’a été transmis dans le lien. Les conseils ci-dessous restent utiles pour décider comment réagir.",
    labelRisk: "Niveau de risque",
    labelLinkType: "Type de lien",
    labelDomainSignal: "Signal du domaine",
    labelThreatDb: "Base de menaces",
    threatDbUnsafeLine: "Signalée dans la base de menaces",
    signalWebRiskLabel: "Vérification des menaces externes",
    webRiskCleanValue: "Aucune correspondance dangereuse connue",
    webRiskUnknownValue: "Vérification indisponible",
    linkExplainStandard:
      "Lien standard — Le lien ne semble pas raccourci, masqué ou formaté de façon inhabituelle.",
    linkExplainShortened: "Lien raccourci — Les liens raccourcis peuvent masquer la destination finale.",
    linkExplainUnusual: "Lien inhabituel — La structure du lien peut mériter une prudence supplémentaire.",
    domainAgeContextNote:
      "Un domaine ancien n’est pas automatiquement sûr, mais un domaine récemment créé est souvent un signal plus préoccupant.",
    domainExplainRecentCoarse:
      "Domaine récent — Ce domaine semble récemment créé selon les données d’enregistrement disponibles.",
    domainExplainMidCoarse:
      "Domaine d’âge intermédiaire — Le domaine est enregistré depuis un certain temps selon les données disponibles.",
    domainExplainEstablishedCoarse:
      "Domaine établi — Le domaine ne semble pas récemment créé selon les données d’enregistrement disponibles.",
    domainExplainUnavailable:
      "Enregistrement du domaine — La date d’enregistrement n’a pas pu être confirmée avec les données disponibles.",
    webRiskCleanDetail:
      "Aucune correspondance dangereuse connue — Aucune correspondance n’a été trouvée dans la base externe utilisée pour ce scan.",
    webRiskUnsafeDetail:
      "Correspondance dangereuse trouvée — Le lien correspond à une base externe de menaces et ne devrait pas être utilisé.",
    webRiskUnavailableDetail:
      "Vérification externe indisponible — ScanScam n’a pas pu confirmer ce signal pour ce scan.",
    linkBasedChecksLabel: "Vérifications liées aux liens",
    linkBasedChecksNAValue: "Non applicable",
    linkBasedChecksNADetail:
      "Aucun lien utilisable n’a été trouvé dans le message soumis; les vérifications de lien, de domaine et de menace externe n’ont donc pas été effectuées pour ce scan.",
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
      "Ce rapport repose sur les informations soumises. Un lien seul peut montrer des signaux d’infrastructure, mais il peut ne pas révéler l’expéditeur, la demande ou l’action souhaitée.",
    whyConfidenceBody2: "ScanScam évite de sur-interpréter les entrées incomplètes.",
    limitsTitle: "Limites importantes",
    limitsBody:
      "ScanScam vous aide à comprendre les messages suspects et à choisir une prochaine étape plus sûre. Il ne garantit pas qu’un message est légitime ou frauduleux et ne constitue pas un avis juridique, financier ou technique. En cas de doute, vérifiez auprès de la source officielle.",
    shareTitle: "Partager ou conserver ce rapport",
    shareText:
      "Utilisez ce rapport comme résumé clair et horodaté à conserver ou à envoyer à une personne de confiance, un proche, le soutien au travail, une banque ou un fournisseur de services.",
    shareUseLinkAbove:
      "Utilisez le lien privé en haut de cette page si vous souhaitez partager ce rapport.",
    reportFeedbackTitle: "Ce rapport vous a-t-il été utile ?",
    feedbackYes: "Oui",
    feedbackSomewhat: "Un peu",
    feedbackNo: "Non",
    feedbackHelpedLabel: "Qu’est-ce qui vous a le plus aidé ?",
    feedbackMissingLabel: "Qu’est-ce qui manquait ?",
    feedbackSend: "Envoyer les commentaires",
    feedbackThanks: "Merci pour vos commentaires.",
    feedbackPrivacy:
      "Veuillez ne pas inclure d’informations personnelles sensibles telles que mots de passe, données bancaires, codes de vérification ou numéros d’identité gouvernementaux.",
    feedbackError: "Envoi impossible. Veuillez réessayer.",
    back: "Retour au résultat",
    backScan: "Retour à l’analyse",
    tier: {
      low: {
        recPrimary:
          "Aucun signal d’avertissement fort n’a été trouvé à partir des informations soumises.",
        recSupporting:
          "Ce résultat semble à faible risque d’après les signaux disponibles. Si le message était inattendu, vérifiez auprès de la source officielle avant d’agir.",
        riskTitle: "Ce que signifie ce résultat",
        riskBody: [
          "Cette analyse n’a pas trouvé de signaux d’avertissement forts dans les informations soumises.",
          "Un résultat à faible risque s’applique seulement à cette analyse précise. Un lien ou un court message peut ne pas montrer le message complet, l’expéditeur ou la demande, donc ScanScam évite de sur-interpréter les entrées incomplètes.",
        ],
        doTitle: "Sur quoi veiller ensuite",
        doIntro:
          "Cette analyse semble à faible risque d’après ce qui a été soumis. Réexaminez la situation si un nouveau message ou un suivi vous demande d’agir, de partager des renseignements, de payer, de saisir un code ou de réagir sous pression.",
        doBullets: [
          "Une demande d’argent, de mots de passe, de codes, de données bancaires ou de renseignements personnels",
          "Une pression pour agir vite",
          "Un expéditeur que vous ne pouvez pas vérifier",
          "Un message qui ne correspond pas à ce que vous attendiez",
          "Des messages répétés ou inhabituels, surtout dans un contexte professionnel",
        ],
        doClosing:
          "Si c’est lié au travail ou à des messages inhabituels répétés, envoyez le rapport à la TI ou à une personne qui peut examiner le contexte plus large.",
        escTitle: "",
        escIntro: null,
        escBullets: [],
      },
      medium: {
        recPrimary: "N’agissez pas tant que la source et l’action demandée ne sont pas vérifiées.",
        recSupporting:
          "ScanScam a détecté des signaux de prudence. L’étape la plus sûre est de vérifier auprès de la source officielle avant de cliquer, répondre, payer ou partager davantage d’informations.",
        riskTitle: "Pourquoi cela mérite attention",
        riskBody: [
          "Cette analyse a trouvé des signaux de prudence qui méritent attention avant d’agir.",
        ],
        doTitle: "Que faire avant d’agir",
        doBullets: [
          "N’utilisez pas le lien tant que la source n’est pas vérifiée.",
          "Allez sur le site officiel manuellement.",
          "Vérifiez par un canal de confiance avant de cliquer, répondre, payer ou partager des informations.",
        ],
        doIntro: null,
        doClosing: null,
        escTitle: "Si vous avez déjà interagi",
        escIntro: null,
        escBullets: [
          "Arrêtez toute action pour l’instant.",
          "Si vous avez saisi un mot de passe ou un code, modifiez-le via le site officiel.",
          "Si vous avez payé ou communiqué des données bancaires, contactez votre banque ou votre fournisseur.",
          "Si c’était lié au travail, envoyez ce rapport à la TI ou à votre contact d’assistance.",
        ],
      },
      high: {
        recPrimary:
          "Ne cliquez pas, ne répondez pas, ne payez pas et ne partagez pas d’informations tant que cela n’est pas vérifié par une source officielle.",
        recSupporting:
          "ScanScam a détecté des signaux d’avertissement plus forts pouvant indiquer une intention suspecte, une pression ou une demande d’agir.",
        riskTitle: "Ce qui a déclenché le risque",
        riskBody: [
          "Cette analyse a trouvé des signaux d’avertissement plus forts qui devraient être vérifiés avant toute autre action.",
        ],
        doTitle: "Que faire maintenant",
        doBullets: [
          "Ne cliquez pas, ne répondez pas, ne payez pas et ne partagez pas d’informations.",
          "Ne saisissez pas de mots de passe, codes, données bancaires ou renseignements personnels.",
          "Vérifiez via le site officiel, le fournisseur, la banque, le soutien au travail ou un autre canal de confiance.",
        ],
        doIntro: null,
        doClosing: null,
        escTitle: "Si vous avez déjà interagi",
        escIntro: null,
        escBullets: [
          "Arrêtez toute action.",
          "Si vous avez saisi un mot de passe ou un code, modifiez-le immédiatement via le site officiel.",
          "Si vous avez payé ou communiqué des données bancaires, contactez immédiatement votre banque ou votre fournisseur.",
          "Si c’était lié au travail, envoyez ce rapport à la TI ou à la sécurité.",
        ],
      },
    },
  },
} as const;

type Lang = "en" | "fr";
type RiskBand = "low" | "medium" | "high";
type UsefulChoice = "yes" | "somewhat" | "no" | null;

type SignalRow = { label: string; value: string; details: string[] };

function formatDomainAgePhrase(days: number, lang: Lang): string {
  if (lang === "fr") {
    if (days < 30) return `actif depuis environ ${days} jour${days > 1 ? "s" : ""}`;
    if (days < 365) {
      const mo = Math.max(1, Math.round(days / 30));
      return `actif depuis environ ${mo} mois`;
    }
    const y = Math.floor(days / 365);
    return `actif depuis environ ${y} an${y > 1 ? "s" : ""}`;
  }
  if (days < 30) return `Active for about ${days} day${days !== 1 ? "s" : ""}`;
  if (days < 365) {
    const mo = Math.max(1, Math.round(days / 30));
    return `Active for about ${mo} month${mo !== 1 ? "s" : ""}`;
  }
  const y = Math.floor(days / 365);
  return `Active for about ${y} year${y !== 1 ? "s" : ""}`;
}

function buildSignalRows(lang: Lang, tel: DecisionReportTelemetry): SignalRow[] {
  const t = copy[lang];
  const rows: SignalRow[] = [];

  const risk = mapOrPassThrough(t.riskTier as Record<string, string>, tel.risk_tier, lang);
  if (risk) rows.push({ label: t.labelRisk, value: risk, details: [] });

  if (!tel.has_usable_link) {
    rows.push({
      label: t.linkBasedChecksLabel,
      value: t.linkBasedChecksNAValue,
      details: [t.linkBasedChecksNADetail],
    });
    return rows;
  }

  const ltKey = tel.link_type.trim().toLowerCase();
  const ltLabel = mapOrPassThrough(t.linkType as Record<string, string>, tel.link_type, lang);
  if (ltLabel) {
    const detail =
      ltKey === "shortened"
        ? t.linkExplainShortened
        : ltKey === "unusual"
          ? t.linkExplainUnusual
          : t.linkExplainStandard;
    rows.push({ label: t.labelLinkType, value: ltLabel, details: [detail] });
  }

  const domLabel = mapOrPassThrough(t.domainSignal as Record<string, string>, tel.domain_signal, lang);
  const bucket = tel.domain_signal.trim().toLowerCase();
  const ageDays = tel.domain_age_days;
  const domDetails: string[] = [];
  if (ageDays != null && ageDays >= 0 && bucket !== "unavailable" && bucket !== "") {
    const phrase = formatDomainAgePhrase(ageDays, lang);
    domDetails.push(lang === "fr" ? `Âge du domaine : ${phrase}.` : `Domain age: ${phrase}.`);
    domDetails.push(t.domainAgeContextNote);
  } else if (bucket === "recent") {
    domDetails.push(t.domainExplainRecentCoarse);
  } else if (bucket === "mid") {
    domDetails.push(t.domainExplainMidCoarse);
  } else if (bucket === "established") {
    domDetails.push(t.domainExplainEstablishedCoarse);
  } else {
    domDetails.push(t.domainExplainUnavailable);
  }
  rows.push({
    label: t.labelDomainSignal,
    value: domLabel || "—",
    details: domDetails,
  });

  const web = tel.web_risk_status.trim().toLowerCase();
  if (web === "unsafe") {
    rows.push({
      label: t.signalWebRiskLabel,
      value: t.threatDbUnsafeLine,
      details: [t.webRiskUnsafeDetail],
    });
  } else if (web === "clean") {
    rows.push({
      label: t.signalWebRiskLabel,
      value: t.webRiskCleanValue,
      details: [t.webRiskCleanDetail],
    });
  } else {
    rows.push({
      label: t.signalWebRiskLabel,
      value: t.webRiskUnknownValue,
      details: [t.webRiskUnavailableDetail],
    });
  }

  return rows;
}

function effectiveRiskBand(tel: DecisionReportTelemetry): RiskBand {
  const web = tel.web_risk_status.trim().toLowerCase();
  if (web === "unsafe") return "high";
  const r = tel.risk_tier.trim().toLowerCase();
  if (r === "high") return "high";
  if (r === "medium") return "medium";
  return "low";
}

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
  const [reportUseful, setReportUseful] = useState<UsefulChoice>(null);
  const [feedbackText, setFeedbackText] = useState("");
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

  const signalRows = useMemo(() => buildSignalRows(lang, telemetry), [lang, telemetry]);

  const riskBand = useMemo(() => effectiveRiskBand(telemetry), [telemetry]);
  const tierCopy = copy[lang].tier[riskBand];

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
    if (typeof telemetry.domain_age_days === "number" && telemetry.domain_age_days >= 0) {
      props.domain_age_days = String(telemetry.domain_age_days);
    }
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
      const usefulBool = reportUseful === "yes" || reportUseful === "somewhat";
      const somewhatPrefix =
        reportUseful === "somewhat"
          ? lang === "fr"
            ? "[Évaluation : un peu utile]"
            : "[Feedback rating: somewhat]"
          : "";
      const combinedFeedback = [somewhatPrefix, feedbackText.trim()].filter(Boolean).join("\n\n");
      const res = await fetch("/api/pro-report/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenForFeedback,
          useful: usefulBool,
          feedback_text: combinedFeedback || undefined,
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
          report_useful: reportUseful,
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
        className={
          riskBand === "low"
            ? "mt-8 rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-4"
            : "mt-8 rounded-lg border-2 border-slate-800 bg-slate-50 px-4 py-4"
        }
        aria-labelledby="recommended-action"
      >
        <h2 id="recommended-action" className="text-sm font-bold uppercase tracking-wide text-slate-900">
          {t.recommendedTitle}
        </h2>
        <p className="mt-3 text-base font-semibold leading-snug text-slate-900">{tierCopy.recPrimary}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{tierCopy.recSupporting}</p>
        <p className="mt-3 text-sm text-slate-600">{confidenceDisplay(lang, confidenceTier)}</p>
      </section>

      {riskBand !== "low" ? (
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
      ) : null}

      <section className="mt-8" aria-labelledby="what-risky">
        <h2 id="what-risky" className="text-base font-bold text-slate-900">
          {tierCopy.riskTitle}
        </h2>
        {tierCopy.riskBody.map((para) => (
          <p key={para} className="mt-2 text-sm leading-relaxed text-slate-700">
            {para}
          </p>
        ))}
      </section>

      <section className="mt-8" aria-labelledby="signals">
        <h2 id="signals" className="text-base font-bold text-slate-900">
          {t.signalsTitle}
        </h2>
        {signalRows.length > 0 ? (
          <ul className="mt-3 list-none space-y-3 text-sm text-slate-700">
            {signalRows.map((row) => (
              <li key={`${row.label}-${row.value}`} className="space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <span className="font-semibold text-slate-800">{row.label}:</span> {row.value}
                  </span>
                </div>
                {row.details.map((line) => (
                  <p key={line} className="pl-6 text-sm leading-relaxed text-slate-600">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.signalsNone}</p>
        )}
      </section>

      {showWhyLimited && riskBand !== "low" ? (
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
          {tierCopy.doTitle}
        </h2>
        {tierCopy.doIntro ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{tierCopy.doIntro}</p>
        ) : null}
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {tierCopy.doBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {tierCopy.doClosing ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{tierCopy.doClosing}</p>
        ) : null}
      </section>

      {riskBand !== "low" ? (
        <section
          className="mt-8 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-4"
          aria-labelledby="escalation-path"
        >
          <h2 id="escalation-path" className="text-base font-bold text-slate-900">
            {tierCopy.escTitle}
          </h2>
          {tierCopy.escIntro ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{tierCopy.escIntro}</p>
          ) : null}
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-medium leading-relaxed text-slate-800">
            {tierCopy.escBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

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

      <section className="mt-8 rounded-lg border border-slate-200 bg-white px-4 py-4" aria-labelledby="limits">
        <h2 id="limits" className="text-base font-bold text-slate-900">
          {t.limitsTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.limitsBody}</p>
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
                    setReportUseful("yes");
                    setFeedbackError(null);
                  }}
                  className={`${choiceBtn} ${
                    reportUseful === "yes"
                      ? "border-slate-600 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  {t.feedbackYes}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportUseful("somewhat");
                    setFeedbackError(null);
                  }}
                  className={`${choiceBtn} ${
                    reportUseful === "somewhat"
                      ? "border-slate-600 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  {t.feedbackSomewhat}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportUseful("no");
                    setFeedbackError(null);
                  }}
                  className={`${choiceBtn} ${
                    reportUseful === "no"
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
                      {reportUseful !== "no" ? t.feedbackHelpedLabel : t.feedbackMissingLabel}
                    </span>
                    <textarea
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.feedbackPrivacy}</p>
                  </label>
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
