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
    decisionSummaryTitle: "Decision summary",
    riskBadgeLow: "Low risk",
    riskBadgeMedium: "Medium risk",
    riskBadgeHigh: "High risk",
    scannedItemTitle: "Scanned item",
    scannedMessageNoLinkLabel: "Scanned message",
    scannedMessageNoLinkDetail: "No usable link was found in this scan.",
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
    signalsTitle: "What ScanScam checked",
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
    messageFromTitle: "From the message",
    messageFromHelper:
      "These signals are based on the wording and context submitted. They are not proof of who sent the message.",
    msgLabelPossiblePattern: "Possible pattern",
    msgLabelActionRequested: "Action requested",
    msgLabelPaymentWording: "Payment or account wording",
    msgLabelPressure: "Pressure signal",
    msgLabelAuthorityStyle: "Authority style",
    guidanceModifiersTitle: "Helpful context",
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
      "Use this time-stamped report as a clear summary you can keep or send to someone you trust, IT, a bank, or a service provider.",
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
          "This result appears low risk based on the available signals. A low-risk result applies only to this scan; review the situation again if a later message asks for money, codes, personal information, or urgent action.",
        riskTitle: "What this result means",
        riskBody: [
          "This scan did not find strong warning signs in the submitted information.",
          "A low-risk result applies only to this specific scan. A link or short message may not show the full message, sender, or request, so ScanScam avoids over-interpreting incomplete inputs.",
        ],
        doTitle: "What could change this result",
        doIntro:
          "This scan looks low risk based on what was submitted. Review the situation again if a follow-up message asks for:",
        doBullets: [
          "money",
          "passwords or verification codes",
          "banking details or personal information",
          "urgent action",
          "a reply from a sender you cannot verify",
        ],
        doClosing:
          "If this is work-related or part of repeated unusual messages, share the report with IT or someone who can review the broader pattern.",
        escTitle: "",
        escIntro: null,
        escBullets: [],
      },
      medium: {
        recPrimary: "Pause before acting until the source and requested action are verified.",
        recSupporting:
          "ScanScam found cautionary signals. You do not need to decide in a rush; verify through an official source or trusted contact method before clicking, replying, paying, or sharing more information.",
        riskTitle: "Why this deserves attention",
        riskBody: ["This scan found cautionary signals that deserve attention before you act."],
        doTitle: "What to verify before acting",
        doBullets: [
          "Do not follow the request until the source is verified.",
          "Use the official website or a trusted contact method.",
          "Verify before clicking, replying, paying, or sharing information.",
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
          "Stop before acting. Do not click, reply, pay, or share more information until this is verified through an official source.",
        recSupporting:
          "ScanScam found stronger warning signs that may indicate suspicious intent, pressure, or a request to act. The safest next step is to verify outside the message.",
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
    decisionSummaryTitle: "Résumé décisionnel",
    riskBadgeLow: "Risque faible",
    riskBadgeMedium: "Risque moyen",
    riskBadgeHigh: "Risque élevé",
    scannedItemTitle: "Élément analysé",
    scannedMessageNoLinkLabel: "Message scanné",
    scannedMessageNoLinkDetail: "Aucun lien utilisable n’a été trouvé dans ce scan.",
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
    signalsTitle: "Ce que ScanScam a vérifié",
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
    messageFromTitle: "Dans le message",
    messageFromHelper:
      "Ces signaux sont basés sur le texte et le contexte soumis. Ils ne prouvent pas qui a envoyé le message.",
    msgLabelPossiblePattern: "Thème possible",
    msgLabelActionRequested: "Action demandée",
    msgLabelPaymentWording: "Formulation liée au paiement ou au compte",
    msgLabelPressure: "Signal de pression",
    msgLabelAuthorityStyle: "Style d’autorité",
    guidanceModifiersTitle: "Contexte utile",
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
      "Utilisez ce rapport horodaté comme un résumé clair que vous pouvez conserver ou envoyer à une personne de confiance, à l’équipe TI, à une banque ou à un fournisseur de service.",
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
          "Aucun signal fortement inquiétant n’a été trouvé à partir des informations soumises.",
        recSupporting:
          "Ce résultat semble faible risque selon les signaux disponibles. Un résultat faible risque s’applique seulement à ce scan; revoyez la situation si un autre message demande de l’argent, des codes, des informations personnelles ou une action urgente.",
        riskTitle: "Ce que signifie ce résultat",
        riskBody: [
          "Cette analyse n’a pas trouvé de signaux d’avertissement forts dans les informations soumises.",
          "Un résultat à faible risque s’applique seulement à cette analyse précise. Un lien ou un court message peut ne pas montrer le message complet, l’expéditeur ou la demande, donc ScanScam évite de sur-interpréter les entrées incomplètes.",
        ],
        doTitle: "Ce qui pourrait changer ce résultat",
        doIntro:
          "Ce scan semble faible risque selon ce qui a été soumis. Revoyez la situation si un message de suivi demande :",
        doBullets: [
          "de l’argent",
          "des mots de passe ou des codes de vérification",
          "des données bancaires ou des informations personnelles",
          "une action urgente",
          "une réponse à un expéditeur que vous ne pouvez pas vérifier",
        ],
        doClosing:
          "Si c’est lié au travail ou à des messages répétés ou inhabituels, partagez le rapport avec l’équipe TI ou quelqu’un qui peut examiner le contexte plus large.",
        escTitle: "",
        escIntro: null,
        escBullets: [],
      },
      medium: {
        recPrimary:
          "Faites une pause avant d’agir, jusqu’à ce que la source et l’action demandée soient vérifiées.",
        recSupporting:
          "ScanScam a trouvé des signaux qui méritent prudence. Vous n’avez pas besoin de décider dans la précipitation; vérifiez par une source officielle ou un moyen de contact fiable avant de cliquer, répondre, payer ou partager plus d’informations.",
        riskTitle: "Pourquoi cela mérite attention",
        riskBody: [
          "Cette analyse a trouvé des signaux de prudence qui méritent attention avant d’agir.",
        ],
        doTitle: "Quoi vérifier avant d’agir",
        doBullets: [
          "Ne suivez pas la demande avant d’avoir vérifié la source.",
          "Utilisez le site officiel ou un moyen de contact fiable.",
          "Vérifiez avant de cliquer, répondre, payer ou partager des informations.",
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
          "Arrêtez-vous avant d’agir. Ne cliquez pas, ne répondez pas, ne payez pas et ne partagez pas plus d’informations avant d’avoir vérifié par une source officielle.",
        recSupporting:
          "ScanScam a trouvé des signaux plus sérieux qui peuvent indiquer une intention suspecte, une pression ou une demande d’action. La prochaine étape la plus sûre est de vérifier en dehors du message.",
        riskTitle: "Ce qui a déclenché le risque",
        riskBody: [
          "Cette analyse a trouvé des signaux d’avertissement plus forts qui devraient être vérifiés avant toute autre action.",
        ],
        doTitle: "Quoi faire maintenant",
        doBullets: [
          "Ne cliquez pas, ne répondez pas, ne payez pas et ne partagez pas plus d’informations.",
          "N’entrez pas de mots de passe, de codes, de données bancaires ou d’informations personnelles.",
          "Vérifiez par le site officiel, le fournisseur, la banque, le support au travail ou un autre canal fiable.",
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

type MsgInterpRow = { label: string; value: string };

const MESSAGE_SLUG_HIDE = new Set(["", "unknown", "none"]);

const NARRATIVE_VALUE: Record<Lang, Record<string, string>> = {
  en: {
    delivery_scam: "Delivery or package issue",
    government_impersonation: "Government-style request",
    law_enforcement: "Law-enforcement-style pressure",
    account_verification: "Account verification",
    employment_scam: "Job or employment offer",
    recovery_scam: "Recovery or refund help",
    reward_claim: "Reward or refund claim",
    social_engineering_opener: "Conversation opener",
    investment_fraud: "Investment or money opportunity",
  },
  fr: {
    delivery_scam: "Problème de livraison ou de colis",
    government_impersonation: "Demande de style gouvernemental",
    law_enforcement: "Pression de style forces de l’ordre",
    account_verification: "Vérification de compte",
    employment_scam: "Offre d’emploi ou de travail",
    recovery_scam: "Aide au recouvrement ou au remboursement",
    reward_claim: "Réclamation de récompense ou de remboursement",
    social_engineering_opener: "Entame de conversation",
    investment_fraud: "Placement ou opportunité financière",
  },
};

const REQUESTED_ACTION_VALUE: Record<Lang, Record<string, string>> = {
  en: {
    click_link: "Click a link",
    call_number: "Call a number",
    submit_credentials: "Enter login details or a code",
    pay_money: "Pay or transfer money",
    reply_sms: "Reply to the message",
    download_app: "Download an app",
  },
  fr: {
    click_link: "Cliquer sur un lien",
    call_number: "Composer un numéro",
    submit_credentials: "Saisir des identifiants ou un code",
    pay_money: "Payer ou virer de l’argent",
    reply_sms: "Répondre au message",
    download_app: "Télécharger une application",
  },
};

const PAYMENT_INTENT_VALUE: Record<Lang, Record<string, string>> = {
  en: {
    credential_to_enable_payment: "Account or login details connected to payment",
    direct_payment_request: "Direct payment request",
    claim_reward_or_refund: "Reward or refund claim",
    fee_or_debt_pressure: "Fee, debt, or balance pressure",
    billing_or_account_resolution: "Billing or account issue",
  },
  fr: {
    credential_to_enable_payment: "Identifiants ou connexion liés à un paiement",
    direct_payment_request: "Demande de paiement direct",
    claim_reward_or_refund: "Réclamation de récompense ou de remboursement",
    fee_or_debt_pressure: "Frais, dette ou solde mis en avant",
    billing_or_account_resolution: "Problème de facturation ou de compte",
  },
};

const ESCALATION_VALUE: Record<Lang, Record<string, string>> = {
  en: {
    time_pressure: "Time pressure or urgency",
    legal_threat: "Legal or enforcement pressure",
    account_threat: "Account access or suspension threat",
  },
  fr: {
    time_pressure: "Pression liée au temps ou à l’urgence",
    legal_threat: "Pression juridique ou d’application de la loi",
    account_threat: "Menace d’accès au compte ou de suspension",
  },
};

const AUTHORITY_TYPE_VALUE: Record<Lang, Record<string, string>> = {
  en: {
    government: "Government-style wording",
    financial_institution: "Bank or financial-institution style",
    corporate: "Company or service-provider style",
    tech_company: "Technology-platform style",
  },
  fr: {
    government: "Formulation de style gouvernemental",
    financial_institution: "Style banque ou institution financière",
    corporate: "Style entreprise ou fournisseur de services",
    tech_company: "Style plateforme technologique",
  },
};

function lookupMessageMap(lang: Lang, table: Record<Lang, Record<string, string>>, slug: string): string {
  const k = slug.trim().toLowerCase();
  if (!k || MESSAGE_SLUG_HIDE.has(k)) return "";
  const label = table[lang][k];
  return label?.trim() ? label : "";
}

/** Human rows for “From the message”; omits unknown/none and unmapped slugs. */
function buildMessageInterpretationRows(lang: Lang, tel: DecisionReportTelemetry): MsgInterpRow[] {
  const t = copy[lang];
  const rows: MsgInterpRow[] = [];
  const nar = lookupMessageMap(lang, NARRATIVE_VALUE, tel.narrative_family);
  if (nar) rows.push({ label: t.msgLabelPossiblePattern, value: nar });
  const act = lookupMessageMap(lang, REQUESTED_ACTION_VALUE, tel.requested_action);
  if (act) rows.push({ label: t.msgLabelActionRequested, value: act });
  const pay = lookupMessageMap(lang, PAYMENT_INTENT_VALUE, tel.payment_intent);
  if (pay) rows.push({ label: t.msgLabelPaymentWording, value: pay });
  const esc = lookupMessageMap(lang, ESCALATION_VALUE, tel.escalation_pattern);
  if (esc) rows.push({ label: t.msgLabelPressure, value: esc });
  const auth = lookupMessageMap(lang, AUTHORITY_TYPE_VALUE, tel.authority_type);
  if (auth) rows.push({ label: t.msgLabelAuthorityStyle, value: auth });
  return rows;
}

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

const GUIDANCE_MODIFIER_PHRASES: Record<
  Lang,
  { payment: string; pressure: string; authority: string; link: string }
> = {
  en: {
    payment:
      "Do not enter passwords, verification codes, banking details, or payment information through a link or contact method in the message.",
    pressure:
      "Pressure is a reason to slow down. You do not need to act from the message itself.",
    authority:
      "If this appears to come from an organization, verify through the official website or a trusted contact method — not through the message.",
    link: "Open the official website manually instead of using the link in the message.",
  },
  fr: {
    payment:
      "N’entrez pas de mots de passe, de codes de vérification, de données bancaires ou d’informations de paiement à partir d’un lien ou d’un contact dans le message.",
    pressure:
      "La pression est une raison de ralentir. Vous n’avez pas besoin d’agir à partir du message lui-même.",
    authority:
      "Si cela semble venir d’une organisation, vérifiez par le site officiel ou un moyen de contact fiable — pas à partir du message.",
    link: "Ouvrez le site officiel manuellement plutôt que d’utiliser le lien dans le message.",
  },
};

function buildGuidanceModifiers(
  tel: DecisionReportTelemetry,
  lang: Lang,
  riskBand: RiskBand
): string[] {
  const ra = tel.requested_action.trim().toLowerCase();
  const pi = tel.payment_intent.trim().toLowerCase();
  const payConcrete = pi.length > 0 && pi !== "none" && pi !== "unknown";
  const paymentApplies =
    ra === "submit_credentials" || ra === "pay_money" || payConcrete;

  const esc = tel.escalation_pattern.trim().toLowerCase();
  const pressureApplies =
    esc === "time_pressure" || esc === "legal_threat" || esc === "account_threat";

  const auth = tel.authority_type.trim().toLowerCase();
  const authorityApplies =
    auth === "government" ||
    auth === "financial_institution" ||
    auth === "corporate" ||
    auth === "tech_company";

  const linkApplies =
    tel.has_usable_link === true && (riskBand === "medium" || riskBand === "high");

  const phrases = GUIDANCE_MODIFIER_PHRASES[lang];
  const ordered: string[] = [];
  if (paymentApplies) ordered.push(phrases.payment);
  if (pressureApplies) ordered.push(phrases.pressure);
  if (authorityApplies) ordered.push(phrases.authority);
  if (linkApplies) ordered.push(phrases.link);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of ordered) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 2) break;
  }
  return out;
}

function riskBadgeText(lang: Lang, band: RiskBand): string {
  const x = copy[lang];
  if (band === "low") return x.riskBadgeLow;
  if (band === "medium") return x.riskBadgeMedium;
  return x.riskBadgeHigh;
}

function riskBadgeClass(band: RiskBand): string {
  if (band === "low") return "bg-emerald-100/90 text-emerald-950 ring-1 ring-emerald-300/50";
  if (band === "medium") return "bg-amber-100 text-amber-950 ring-1 ring-amber-300/70";
  return "bg-rose-100 text-rose-950 ring-1 ring-rose-200/80";
}

/** Ensure shared report URLs carry ?lang= for consistent FR/EN when opened or copied. */
function withReportLang(url: string, lang: Lang): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      u.searchParams.set("lang", lang);
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  const qIndex = trimmed.indexOf("?");
  const path = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const search = qIndex >= 0 ? trimmed.slice(qIndex + 1) : "";
  const params = new URLSearchParams(search);
  params.set("lang", lang);
  return `${path}?${params.toString()}`;
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
    if (fromServer) return withReportLang(fromServer, lang);
    const tok = shareToken?.trim() ?? "";
    if (!tok) return null;
    const pub =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, "")
        : "";
    if (pub) return withReportLang(`${pub}/r/${encodeURIComponent(tok)}`, lang);
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
      setResolvedReportUrl(withReportLang(server, lang));
      return;
    }
    const pub =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, "")
        : "";
    if (pub) {
      setResolvedReportUrl(withReportLang(`${pub}/r/${encodeURIComponent(tok)}`, lang));
      return;
    }
    if (typeof window !== "undefined") {
      setResolvedReportUrl(
        withReportLang(`${window.location.origin}/r/${encodeURIComponent(tok)}`, lang)
      );
      return;
    }
    setResolvedReportUrl(withReportLang(`/r/${encodeURIComponent(tok)}`, lang));
  }, [shareToken, reportAbsoluteUrl, lang]);

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
  const messageInterpretRows = useMemo(() => buildMessageInterpretationRows(lang, telemetry), [lang, telemetry]);

  const riskBand = useMemo(() => effectiveRiskBand(telemetry), [telemetry]);
  const tierCopy = copy[lang].tier[riskBand];
  const guidanceModifiers = useMemo(
    () => buildGuidanceModifiers(telemetry, lang, riskBand),
    [telemetry, lang, riskBand]
  );

  const relativeReportPath = useMemo(() => {
    const tok = shareToken?.trim() ?? "";
    return tok ? withReportLang(`/r/${encodeURIComponent(tok)}`, lang) : "";
  }, [shareToken, lang]);

  const displayReportUrl = useMemo(() => {
    const base = (resolvedReportUrl?.trim() || relativeReportPath).trim();
    return base ? withReportLang(base, lang) : "";
  }, [resolvedReportUrl, relativeReportPath, lang]);

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
          rating: reportUseful,
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
          report_rating: reportUseful,
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

  return (
    <div className="min-h-screen bg-slate-100/95 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-8">
          <header className="border-b border-slate-200/80 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ScanScam</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{t.reportTitle}</h1>
            <p className="mt-2 text-sm font-medium text-slate-700">{t.reportSubtitle}</p>
            <dl className="mt-4 space-y-1.5 text-sm text-slate-800">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-800">{t.reportGeneratedLabel}</dt>
                <dd className="text-slate-700">{generatedStr}</dd>
              </div>
              {scanId ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-slate-800">{t.scanIdLabel}</dt>
                  <dd className="font-mono text-xs text-slate-600 sm:text-sm">{shortenScanId(scanId)}</dd>
                </div>
              ) : null}
            </dl>
          </header>

      <section
        className={
          riskBand === "low"
            ? "mt-8 rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-white px-5 py-6 shadow-md ring-1 ring-slate-900/[0.04]"
            : riskBand === "medium"
              ? "mt-8 rounded-xl border border-amber-300/90 bg-gradient-to-b from-amber-50/50 to-white px-5 py-6 shadow-md ring-1 ring-amber-900/[0.06]"
              : "mt-8 rounded-xl border border-rose-300/90 bg-gradient-to-b from-rose-50/45 to-white px-5 py-6 shadow-md ring-1 ring-rose-900/[0.06]"
        }
        aria-labelledby="decision-summary"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="decision-summary" className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {t.decisionSummaryTitle}
          </h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${riskBadgeClass(riskBand)}`}
          >
            {riskBadgeText(lang, riskBand)}
          </span>
        </div>
        <p className="mt-4 text-lg font-semibold leading-snug text-slate-950">{tierCopy.recPrimary}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{tierCopy.recSupporting}</p>
        {guidanceModifiers.length > 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.guidanceModifiersTitle}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-600">
              {guidanceModifiers.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 border-t border-slate-200/80 pt-3 text-sm text-slate-600">
          {confidenceDisplay(lang, confidenceTier)}
        </p>
      </section>

      <section
        className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/40 px-4 py-3 sm:px-4 sm:py-3.5"
        aria-labelledby="scanned-item"
      >
        <h2 id="scanned-item" className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {t.scannedItemTitle}
        </h2>
        {telemetry.has_usable_link ? (
          analyzedDomain ? (
            <dl className="mt-2 space-y-1.5 text-sm text-slate-700">
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
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.analyzedUnavailable}</p>
          )
        ) : (
          <div className="mt-2 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">{t.scannedMessageNoLinkLabel}</p>
            <p className="mt-1 leading-relaxed text-slate-600">{t.scannedMessageNoLinkDetail}</p>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200/90 bg-slate-50/35 px-4 py-4" aria-labelledby="what-checked">
        <h2 id="what-checked" className="text-base font-bold text-slate-950">
          {t.signalsTitle}
        </h2>
        {signalRows.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-200/80 overflow-hidden rounded-lg border border-slate-200/70 bg-white">
            {signalRows.map((row) => (
              <li key={`${row.label}-${row.value}`} className="px-3 py-3 sm:px-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</div>
                <div className="mt-1 text-sm font-medium text-slate-950">{row.value}</div>
                {row.details.map((line) => (
                  <p key={line} className="mt-1.5 text-xs leading-relaxed text-slate-600">
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

      {messageInterpretRows.length > 0 ? (
        <section
          className="mt-8 rounded-xl border border-slate-200/90 bg-slate-50/35 px-4 py-4"
          aria-labelledby="message-from"
        >
          <h2 id="message-from" className="text-base font-bold text-slate-950">
            {t.messageFromTitle}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{t.messageFromHelper}</p>
          <dl className="mt-3 space-y-2.5 border-t border-slate-200/60 pt-3 text-sm text-slate-800">
            {messageInterpretRows.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt className="font-semibold text-slate-800">{row.label}</dt>
                <dd className="mt-0.5 leading-relaxed text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/30 px-4 py-4" aria-labelledby="what-risky">
        <h2 id="what-risky" className="text-base font-bold text-slate-950">
          {tierCopy.riskTitle}
        </h2>
        {tierCopy.riskBody.map((para) => (
          <p key={para} className="mt-2 text-sm leading-relaxed text-slate-800">
            {para}
          </p>
        ))}
      </section>

      <section
        className={
          riskBand === "low"
            ? "mt-6 rounded-xl border border-slate-200/80 bg-slate-50/25 px-4 py-4"
            : "mt-8 rounded-xl border border-slate-200/80 bg-slate-50/30 px-4 py-4"
        }
        aria-labelledby="do-link"
      >
        <h2 id="do-link" className="text-base font-bold text-slate-950">
          {tierCopy.doTitle}
        </h2>
        {tierCopy.doIntro ? (
          <p
            className={
              riskBand === "low"
                ? "mt-2 text-sm leading-snug text-slate-700"
                : "mt-2 text-sm leading-relaxed text-slate-700"
            }
          >
            {tierCopy.doIntro}
          </p>
        ) : null}
        <ul
          className={
            riskBand === "low"
              ? "mt-2 list-disc space-y-1 pl-5 text-sm leading-snug text-slate-700"
              : "mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700"
          }
        >
          {tierCopy.doBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {tierCopy.doClosing ? (
          <p
            className={
              riskBand === "low"
                ? "mt-2 text-sm leading-snug text-slate-700"
                : "mt-3 text-sm leading-relaxed text-slate-700"
            }
          >
            {tierCopy.doClosing}
          </p>
        ) : null}
      </section>

      {riskBand !== "low" ? (
        <section
          className="mt-8 rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-4"
          aria-labelledby="escalation-path"
        >
          <h2 id="escalation-path" className="text-base font-bold text-slate-950">
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
        className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
        aria-labelledby="share-report"
      >
        <h2 id="share-report" className="text-base font-bold text-slate-950">
          {t.shareTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{t.shareText}</p>
        {token ? (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">{t.secureReportLinkTitle}</p>
            <p className="text-sm leading-relaxed text-slate-600">{t.secureReportLinkBody}</p>
            <p className="text-sm leading-relaxed text-slate-600">{t.secureReportLinkInstruction}</p>
            {displayReportUrl ? (
              <p className="max-w-full break-words font-mono text-xs leading-relaxed text-slate-800 sm:text-sm">
                <a
                  href={displayReportUrl}
                  className="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
                >
                  {displayReportUrl}
                </a>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {displayReportUrl ? <CopyReportLinkButton reportUrl={displayReportUrl} lang={lang} /> : null}
            </div>
            {expiresStr ? (
              <p className="text-xs text-slate-600">
                {t.secureShareExpiresPrefix} {expiresStr}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.secureShareAfterUnlock}</p>
        )}
      </section>

      <section
        className="mt-8 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3.5"
        aria-labelledby="limits"
      >
        <h2 id="limits" className="text-sm font-semibold text-slate-600">
          {t.limitsTitle}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t.limitsBody}</p>
      </section>

      {token ? (
        <section className="mt-8 rounded-xl border border-slate-200/90 bg-white px-4 py-4" aria-labelledby="feedback">
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

      <footer className="mt-10 border-t border-slate-200/90 pt-8">
        <a
          href={backHref}
          className="text-sm font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
        >
          {scanId.length > 0 ? t.back : t.backScan}
        </a>
      </footer>
        </article>
      </div>
    </div>
  );
}
