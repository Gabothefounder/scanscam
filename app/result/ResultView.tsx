"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import { trackConversion } from "@/lib/gtag";
import { getPartnerBySlug } from "@/lib/partners";
import { ContextRefinementCard, type ContextRefinementStrings } from "@/components/ContextRefinementCard";
import {
  parseAbuseInterpretationForSurface,
  type InterpretationSurfaceConcept,
  type ParsedAbuseInterpretationForSurface,
} from "@/lib/scan-analysis/interpretationSurface";

const firedOnce = new Set<string>();

/* ---------- copy ---------- */

const copy = {
  en: {
    tier: {
      low: "Low Risk",
      medium: "Medium Risk",
      high: "High Risk",
    },
    riskLevelLabel: "Risk level:",
    riskLevel: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    confidenceLabel: "System confidence:",
    confidenceLevel: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    confidenceHelper: {
      low: "This result is based on limited context.",
      medium: "This result is based on recognizable suspicious patterns.",
      high: "This result is based on multiple aligned scam indicators.",
    },
    defaultSummary: {
      low: "This message doesn’t look like a typical scam based on what we saw.",
      medium: "This message looks suspicious. Take a moment before you act.",
      high: "This message looks very similar to common scams. Be careful.",
    },
    linkIntel: {
      detectedLabel: "Link detected:",
      linkBeforeClick:
        "Before clicking, make sure the address matches the official website.",
      shortened: "Shortened link (destination hidden)",
      suspiciousTld: "Unusual domain ending (e.g. .xyz)",
      brandMimic: "Domain may mimic a known brand",
      surfaceShortenedExpandedSingle: "This shortened link opens a page on {host}.",
      surfaceShortenedUnresolvedLine1: "This message uses a shortened link.",
      surfaceShortenedUnresolvedLine2: "We couldn’t confirm where it leads.",
      surfaceNormalLink: "This message contains a link to {host}.",
      webRiskLineUnsafe: "Flagged by external threat intelligence",
      webRiskLineUnknown: "No known threats detected in external database",
      webRiskLineSkipped: "Link not checked by external database",
    },
    refinementIncomplete: {
      preliminaryBadge: "Limited analysis — a little context helps",
      headlineLinkOnly: "We only saw a link",
      headlinePhoneOnly: "We only saw a phone number",
      subtextLink: "Tell us how you got it and what it’s asking you to do.",
      subtextPhone: "Tell us how you got it and what it’s asking you to do.",
      supporting: "One or two sentences is enough.",
      artifactHeading: "What we noticed",
      examplesLabel: "Example",
      examplesLink: [
        "Text saying I owe a parking fine",
        "Email from my bank asking me to log in",
        "Message about a package delivery with a link",
      ],
      examplesPhone: [
        "Text or voicemail asking me to call this number back",
        "Message claiming a problem with my bank or account",
        "Text about a delivery, fine, or urgent notice",
      ],
    },
    weakInputGate: {
      heading: "We need more context",
      bodyLine1: "This input is too limited for a reliable analysis.",
      bodyLine2Public: "Add context around this link or number to improve the analysis.",
      bodyLine2Partner:
        "Add context around this link or number so ScanScam can better review the scam pattern.",
      gateExamplePublic: "Canada Post says my package is on hold and I need to pay $2.99.",
      gateExamplePartner:
        "Claimed to be Microsoft support and asked me to install remote access software.",
      gateExamplePublicPhone:
        "Text said my bank account was locked and I had to call this number back.",
      gateExamplePartnerPhone:
        "Caller said they were IT support and needed remote access to my work laptop.",
      gatePlaceholderPublic: "e.g. “Claimed to be RBC and asked for my verification code”",
      gatePlaceholderPartner: "e.g. “Pretended to be RBC and asked for my verification code”",
      limitedAnalysisLink: "Continue without adding context",
      phoneDetectedLabel: "Phone number detected:",
    },
    refinementFollowUp: {
      headline: "Improve result (optional)",
      hint: "Add more detail if something important is missing.",
    },
    contextRefinement: {
      collapsedTitle: "Improve result (optional)",
      collapsedHint: "Add more detail if something important is missing — it helps ScanScam analyze this better.",
      expandLink: "Add context →",
      collapseLink: "← Hide",
      fieldLabel: "Add context",
      fieldHint: "A sentence or two helps ScanScam improve the analysis.",
      examplesLabel: "Example",
      placeholder: "e.g. how you got this, what they asked you to do…",
      submitLabel: "Improve result",
      loadingLabel: "Updating…",
    } satisfies ContextRefinementStrings,
    contextRefinementPartner: {
      collapsedTitle: "Improve result (optional)",
      collapsedHint: "Add more detail if something important is missing — helps ScanScam review the pattern.",
      expandLink: "Add context →",
      collapseLink: "← Hide",
      fieldLabel: "Add context",
      fieldHint: "A sentence or two helps ScanScam review the scam pattern.",
      examplesLabel: "Example",
      placeholder: "e.g. how you got this, what they asked you to do…",
      submitLabel: "Improve result",
      loadingLabel: "Updating…",
    } satisfies ContextRefinementStrings,
    mspTrigger: "Send to your IT provider",
    mspBelowCardHint: "Forward this to your IT provider for security review.",
    mspPromotedSupporting: "Your IT provider will receive the message and review it securely.",
    mspCloseForm: "Close",
    actionTitle: "What to do next",
    guidance: [
      { action: "Pause before responding", explanation: "Legitimate services don't require immediate action." },
      { action: "Verify through the official website", explanation: "Use the official website instead of the link in the message." },
    ],
    narrativeNextSteps: {
      social_engineering_opener: [
        { action: "Do not continue the conversation if it feels unexpected", explanation: "Scammers often use casual openers to build trust before asking for money or details." },
        { action: "Do not share personal, work, or financial information", explanation: "Even small details can be used in follow-up scams." },
        { action: "Verify identity through a separate trusted channel if needed", explanation: "Contact the person through a known official channel, not the one in the message." },
      ],
      recovery_scam: [
        { action: "Do not send money or share account details", explanation: "Legitimate recovery services do not charge upfront fees." },
        { action: "Verify through official channels", explanation: "Report losses to your bank or law enforcement through their official websites or phone numbers." },
        { action: "Be cautious of anyone who contacts you first", explanation: "Genuine recovery options are usually initiated by you, not by unsolicited messages." },
      ],
      account_verification: [
        { action: "Never use links in the message", explanation: "Log in only through the official website or app you already use." },
        { action: "Verify through the official app or website", explanation: "Check your account status directly — legitimate services notify you in-app first." },
        { action: "Contact the service through their official support", explanation: "Use the contact details from the company's verified website, not from the message." },
      ],
      delivery_scam: [
        { action: "Verify tracking through the official carrier", explanation: "Use the carrier's website or app, not any link in the message." },
        { action: "Do not pay fees or share details", explanation: "Real delivery issues are resolved through the official carrier, not by paying through a link." },
        { action: "Check your actual orders", explanation: "Log into your account on the real retailer or carrier site to see if there are any issues." },
      ],
      government_impersonation: [
        { action: "Government agencies do not threaten by email or SMS", explanation: "CRA, Service Canada, and similar agencies use mail for official matters." },
        { action: "Never share your SIN, passwords, or banking details", explanation: "No legitimate agency will ask for these via text or unsolicited email." },
        { action: "Verify through official government portals", explanation: "Go directly to canada.ca or the agency's official site — never through a link in the message." },
      ],
    } as Record<string, { action: string; explanation: string }[]>,
    backHome: "Back to home",
    scanAnother: "Scan another message",
    /** Appended after partner name: "{name} — your IT security partner" */
    partnerBrandingRole: " — your IT security partner",
    poweredByScanScam: "Powered by ScanScam",
    sendToItCta: {
      low: "Still unsure? Send to your IT provider",
      medium: "Share with my IT provider for review",
      high: "Urgent: share with my IT provider",
    },
    escalationForm: {
      title: "Still unsure? Send to your IT provider",
      nameLabel: "Name",
      namePlaceholder: "Your name",
      companyLabel: "Company",
      companyPlaceholder: "Your company",
      roleLabel: "Role (optional)",
      rolePlaceholder: "e.g. Employee, Manager",
      noteLabel: "Note for your IT provider",
      noteHelper: "Optional — explain what feels unclear or important.",
      notePlaceholder:
        'Example: "This looks work-related and I’m not sure if I should ignore it."',
      submissionInfo:
        "Your message, analysis, and note will be shared with your IT provider.",
      submitButton: "Send",
      successMessage: "Escalation sent successfully. Your IT provider can now review this scan.",
      errorMessage: "We could not send this escalation right now. Please try again in a moment.",
      sending: "Sending…",
    },
    footerAdvisory:
      "ScanScam provides a pattern-based risk assessment. When in doubt, verify through the official source.",
    whySuspicious: "Why this was flagged",
    groundedReasons: {
      limited_context: "Limited context — not enough information to classify reliably",
      narrative: {
        delivery_scam: "Delivery or parcel scam pattern",
        government_impersonation: "Government or tax impersonation",
        account_verification: "Account verification request",
        recovery_scam: "Funds recovery offer",
        reward_claim: "Prize or reward claim",
        law_enforcement: "Law enforcement impersonation",
        employment_scam: "Employment scam pattern",
        social_engineering_opener: "Unexpected personal contact or trust-building opener",
        investment_fraud: "Investment fraud pattern",
      } as Record<string, string>,
      entity: {
        cra: "Impersonates CRA",
        service_canada: "Impersonates Service Canada",
        rcmp: "Impersonates RCMP",
        canada_post: "Impersonates Canada Post",
        wealthsimple: "Impersonates Wealthsimple",
        generic_government: "Impersonates a government agency",
        generic_financial: "Impersonates a financial institution",
        generic_courier: "Impersonates a courier or delivery service",
      } as Record<string, string>,
      action: {
        pay_money: "Asks you to pay",
        click_link: "Asks you to tap or click a link",
        submit_credentials: "Asks you to log in or verify",
        call_number: "Asks you to call a number",
        reply_sms: "Asks you to reply",
        download_app: "Asks you to download an app",
      } as Record<string, string>,
      threat: {
        credential_capture: "Tries to get your login details",
        payment_extraction: "Tries to get a payment or fee",
        post_loss_recovery: "Sounds like a recovery scam",
        initial_lure: "Looks like an opening message or lure",
      } as Record<string, string>,
    },
    signalLabels: {
      urgency: "urgency language",
      payment_request: "payment request",
      delivery_scam: "delivery scam pattern",
      authority_impersonation: "authority impersonation",
      threat: "threat or consequences",
      link_or_credential: "link or credential request",
      impersonation: "impersonation",
      prize_or_winner: "prize or winner claim",
      employment: "employment scam pattern",
      tech_support: "tech support scam pattern",
      government: "government impersonation",
      financial_phishing: "financial phishing pattern",
      romance: "romance scam pattern",
      investment: "investment fraud pattern",
    } as Record<string, string>,
    narrativeGuidance: {
      delivery_scam: "Delivery scams often ask for extra fees—check with the real carrier.",
      employment_scam: "Check job offers on the company’s official site, not through random messages.",
      government_impersonation: "Real agencies don’t demand payment or your SIN by text or email.",
      account_verification: "Don’t use the link in the message—log in only through the app or site you already use.",
      recovery_scam: "Anyone promising to recover lost money for a fee is usually another scam.",
      financial_phishing: "Don’t use links in the message—use the official site or app you trust.",
      prize_scam: "Real prizes don’t ask you to pay first.",
      reward_claim: "Real prizes don’t ask you to pay first.",
      tech_support: "Real tech support won’t cold-call or pop up out of nowhere.",
      romance_scam: "Be careful sending money to someone you’ve only met online.",
      investment_fraud: "Watch out for “guaranteed” returns and pressure to move fast.",
      law_enforcement: "Police don’t collect fines or personal info by random text or email.",
      social_engineering_opener: "This can be a casual opener before a later ask for money or info.",
      unknown: "If it feels off, pause and check with someone you trust.",
    },
  },
  fr: {
    tier: {
      low: "Risque faible",
      medium: "Risque moyen",
      high: "Risque élevé",
    },
    riskLevelLabel: "Niveau de risque :",
    riskLevel: {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
    },
    confidenceLabel: "Confiance du système :",
    confidenceLevel: {
      low: "Faible",
      medium: "Moyenne",
      high: "Élevée",
    },
    confidenceHelper: {
      low: "Ce résultat repose sur un contexte limité.",
      medium: "Ce résultat repose sur des schémas suspects reconnus.",
      high: "Ce résultat repose sur plusieurs indicateurs de fraude concordants.",
    },
    defaultSummary: {
      low: "D’après ce qu’on voit, ce message ne ressemble pas à une arnaque typique.",
      medium: "Ce message semble suspect. Prenez un moment avant d’agir.",
      high: "Ce message ressemble beaucoup à des arnaques courantes. Soyez prudent.",
    },
    linkIntel: {
      detectedLabel: "Lien détecté :",
      linkBeforeClick:
        "Avant de cliquer, assurez-vous que l'adresse correspond au site officiel.",
      shortened: "Lien raccourci (destination masquée)",
      suspiciousTld: "Terminaison de domaine inhabituelle (p. ex. .xyz)",
      brandMimic: "Le domaine peut évoquer une marque connue",
      surfaceShortenedExpandedSingle: "Ce lien raccourci ouvre une page sur {host}.",
      surfaceShortenedUnresolvedLine1: "Ce message utilise un lien raccourci.",
      surfaceShortenedUnresolvedLine2: "Nous n’avons pas pu confirmer où il mène.",
      surfaceNormalLink: "Ce message contient un lien vers {host}.",
      webRiskLineUnsafe: "Signalé par une base de menaces externe",
      webRiskLineUnknown: "Aucune menace connue détectée dans la base externe",
      webRiskLineSkipped: "Lien non vérifié par la base externe",
    },
    refinementIncomplete: {
      preliminaryBadge: "Analyse limitée — un peu de contexte aide",
      headlineLinkOnly: "Nous n’avons vu qu’un lien",
      headlinePhoneOnly: "Nous n’avons vu qu’un numéro",
      subtextLink: "Dites-nous comment vous l’avez reçu et ce qu’on vous demande.",
      subtextPhone: "Dites-nous comment vous l’avez reçu et ce qu’on vous demande.",
      supporting: "Une ou deux phrases suffisent.",
      artifactHeading: "Ce qu’on a remarqué",
      examplesLabel: "Exemple",
      examplesLink: [
        "Un texto disant que je dois une contravention de stationnement",
        "Un courriel de ma banque me demandant de me connecter",
        "Un message sur un colis avec un lien",
      ],
      examplesPhone: [
        "Un texto ou une boîte vocale me demandant de rappeler ce numéro",
        "Un message évoquant un problème avec ma banque ou mon compte",
        "Un texto sur une livraison, une amende ou un avis urgent",
      ],
    },
    weakInputGate: {
      heading: "Il nous faut plus de contexte",
      bodyLine1: "Cette entrée est trop limitée pour une analyse fiable.",
      bodyLine2Public:
        "Ajoutez du contexte autour de ce lien ou numéro pour améliorer l’analyse.",
      bodyLine2Partner:
        "Ajoutez du contexte autour de ce lien ou numéro afin que ScanScam puisse mieux examiner le schéma d’arnaques.",
      gateExamplePublic:
        "Postes Canada dit que mon colis est retenu et que je dois payer 2,99 $.",
      gateExamplePartner:
        "Se prétendant du soutien Microsoft et m’a demandé d’installer un logiciel d’accès à distance.",
      gateExamplePublicPhone:
        "Un texto disait que mon compte bancaire était bloqué et que je devais rappeler ce numéro.",
      gateExamplePartnerPhone:
        "L’appelant disait être le soutien TI et voulait un accès à distance à mon ordinateur professionnel.",
      gatePlaceholderPublic: "p. ex. « Se disant la RBC et demandant mon code de vérification »",
      gatePlaceholderPartner: "p. ex. « S’est fait passer pour la RBC et a demandé mon code de vérification »",
      limitedAnalysisLink: "Continuer sans ajouter de contexte",
      phoneDetectedLabel: "Numéro détecté :",
    },
    refinementFollowUp: {
      headline: "Améliorer le résultat (facultatif)",
      hint: "Ajoutez des précisions si quelque chose d’important manque.",
    },
    contextRefinement: {
      collapsedTitle: "Améliorer le résultat (facultatif)",
      collapsedHint:
        "Ajoutez un détail si quelque chose d’important manque — cela aide ScanScam à mieux analyser ceci.",
      expandLink: "Ajouter du contexte →",
      collapseLink: "← Masquer",
      fieldLabel: "Ajouter du contexte",
      fieldHint: "Une ou deux phrases aident ScanScam à affiner l’analyse.",
      examplesLabel: "Exemple",
      placeholder: "p. ex. comment vous l’avez reçu, ce qu’on vous demande…",
      submitLabel: "Améliorer le résultat",
      loadingLabel: "Mise à jour…",
    } satisfies ContextRefinementStrings,
    contextRefinementPartner: {
      collapsedTitle: "Améliorer le résultat (facultatif)",
      collapsedHint:
        "Ajoutez des précisions si quelque chose d’important manque — cela aide ScanScam à examiner le schéma.",
      expandLink: "Ajouter du contexte →",
      collapseLink: "← Masquer",
      fieldLabel: "Ajouter du contexte",
      fieldHint: "Une ou deux phrases aident ScanScam à examiner le schéma d’arnaques.",
      examplesLabel: "Exemple",
      placeholder: "p. ex. comment vous l’avez reçu, ce qu’on vous demande…",
      submitLabel: "Améliorer le résultat",
      loadingLabel: "Mise à jour…",
    } satisfies ContextRefinementStrings,
    mspTrigger: "Envoyer à votre fournisseur TI",
    mspBelowCardHint: "Transférez ceci à votre fournisseur TI pour examen de sécurité.",
    mspPromotedSupporting:
      "Votre fournisseur TI recevra le message et l’examinera de façon sécurisée.",
    mspCloseForm: "Fermer",
    actionTitle: "Que faire maintenant",
    guidance: [
      { action: "Prenez un moment avant de répondre", explanation: "Les services légitimes n'exigent pas d'action immédiate." },
      { action: "Vérifiez via le site officiel", explanation: "Utilisez le site officiel plutôt que le lien dans le message." },
    ],
    narrativeNextSteps: {
      social_engineering_opener: [
        { action: "Ne poursuivez pas la conversation si elle semble inattendue", explanation: "Les escrocs utilisent souvent des accroches informelles pour gagner la confiance avant de demander de l'argent ou des détails." },
        { action: "Ne partagez pas d'informations personnelles, professionnelles ou financières", explanation: "Même quelques détails peuvent servir dans des arnaques de suivi." },
        { action: "Vérifiez l'identité par un canal distinct et fiable si nécessaire", explanation: "Contactez la personne par un canal officiel connu, pas celui indiqué dans le message." },
      ],
      recovery_scam: [
        { action: "N'envoyez pas d'argent et ne partagez pas vos identifiants", explanation: "Les services de récupération légitimes ne facturent pas de frais à l'avance." },
        { action: "Vérifiez via les canaux officiels", explanation: "Signalez les pertes à votre banque ou aux autorités via leurs sites ou numéros officiels." },
        { action: "Méfiez-vous de quiconque vous contacte en premier", explanation: "Les options de récupération légitimes sont généralement initiées par vous, pas par des messages non sollicités." },
      ],
      account_verification: [
        { action: "N'utilisez jamais les liens du message", explanation: "Connectez-vous uniquement via le site ou l'app officiels que vous utilisez déjà." },
        { action: "Vérifiez via l'app ou le site officiel", explanation: "Consultez le statut de votre compte directement — les services légitimes vous informent d'abord dans l'app." },
        { action: "Contactez le service via leur support officiel", explanation: "Utilisez les coordonnées du site vérifié de l'entreprise, pas celles du message." },
      ],
      delivery_scam: [
        { action: "Vérifiez le suivi via le transporteur officiel", explanation: "Utilisez le site ou l'app du transporteur, pas un lien du message." },
        { action: "Ne payez pas de frais ni ne partagez de détails", explanation: "Les vrais problèmes de livraison sont résolus par le transporteur officiel, pas en payant via un lien." },
        { action: "Vérifiez vos commandes réelles", explanation: "Connectez-vous à votre compte sur le site du détaillant ou du transporteur pour voir s'il y a des problèmes." },
      ],
      government_impersonation: [
        { action: "Les organismes gouvernementaux ne menacent pas par courriel ou SMS", explanation: "L'ARC, Service Canada et d'autres organismes utilisent le courrier pour les affaires officielles." },
        { action: "Ne partagez jamais votre NAS, mots de passe ou informations bancaires", explanation: "Aucun organisme légitime ne demandera ces informations par texto ou courriel non sollicité." },
        { action: "Vérifiez via les portails gouvernementaux officiels", explanation: "Allez directement sur canada.ca ou le site officiel de l'organisme — jamais via un lien du message." },
      ],
    } as Record<string, { action: string; explanation: string }[]>,
    backHome: "Retour à l'accueil",
    scanAnother: "Analyser un autre message",
    partnerBrandingRole: " — votre partenaire de sécurité TI",
    poweredByScanScam: "Propulsé par ScanScam",
    sendToItCta: {
      low: "Encore un doute ? Envoyez à votre fournisseur TI",
      medium: "Partager avec mon fournisseur TI pour révision",
      high: "Urgent : partager avec mon fournisseur TI",
    },
    escalationForm: {
      title: "Encore un doute ? Envoyez à votre fournisseur TI",
      nameLabel: "Nom",
      namePlaceholder: "Votre nom",
      companyLabel: "Entreprise",
      companyPlaceholder: "Votre entreprise",
      roleLabel: "Rôle (optionnel)",
      rolePlaceholder: "p. ex. Employé, Gestionnaire",
      noteLabel: "Note pour votre fournisseur TI",
      noteHelper: "Facultatif — expliquez ce qui semble peu clair ou important.",
      notePlaceholder:
        "Exemple : « Cela semble lié au travail et je ne suis pas sûr·e de l’ignorer. »",
      submissionInfo:
        "Votre message, l'analyse et la note seront partagés avec votre fournisseur TI.",
      submitButton: "Envoyer",
      successMessage: "Escalade envoyée avec succès. Votre fournisseur TI peut maintenant réviser cette analyse.",
      errorMessage: "Nous n'avons pas pu envoyer cette escalade pour le moment. Veuillez réessayer dans un instant.",
      sending: "Envoi en cours…",
    },
    footerAdvisory:
      "ScanScam fournit une évaluation du risque basée sur des modèles de fraude connus. En cas de doute, vérifiez auprès de la source officielle.",
    whySuspicious: "Pourquoi nous l’avons signalé",
    groundedReasons: {
      limited_context: "Contexte limité — pas assez d'informations pour classer de façon fiable",
      narrative: {
        delivery_scam: "Schéma d'arnaque aux colis",
        government_impersonation: "Usurpation gouvernementale ou fiscale",
        account_verification: "Demande de vérification de compte",
        recovery_scam: "Offre de récupération de fonds",
        reward_claim: "Promesse de gain ou de prix",
        law_enforcement: "Usurpation des forces de l'ordre",
        employment_scam: "Schéma d'arnaque à l'emploi",
        social_engineering_opener: "Contact personnel inattendu ou accroche de confiance",
        investment_fraud: "Schéma de fraude à l'investissement",
      } as Record<string, string>,
      entity: {
        cra: "Usurpe l'ARC",
        service_canada: "Usurpe Service Canada",
        rcmp: "Usurpe la GRC",
        canada_post: "Usurpe Postes Canada",
        wealthsimple: "Usurpe Wealthsimple",
        generic_government: "Usurpe un organisme gouvernemental",
        generic_financial: "Usurpe une institution financière",
        generic_courier: "Usurpe un service de messagerie",
      } as Record<string, string>,
      action: {
        pay_money: "Vous demande de payer",
        click_link: "Vous demande d’ouvrir ou de cliquer un lien",
        submit_credentials: "Vous demande de vous connecter ou de vérifier",
        call_number: "Vous demande d’appeler un numéro",
        reply_sms: "Vous demande de répondre",
        download_app: "Vous demande de télécharger une application",
      } as Record<string, string>,
      threat: {
        credential_capture: "Cherche à obtenir vos identifiants",
        payment_extraction: "Cherche un paiement ou des frais",
        post_loss_recovery: "Ressemble à une arnaque de récupération",
        initial_lure: "Ressemble à un premier contact ou une accroche",
      } as Record<string, string>,
    },
    signalLabels: {
      urgency: "langage d'urgence",
      payment_request: "demande de paiement",
      delivery_scam: "schéma d'arnaque aux colis",
      authority_impersonation: "usurpation d'autorité",
      threat: "menace ou conséquences",
      link_or_credential: "demande de lien ou identifiants",
      impersonation: "usurpation d'identité",
      prize_or_winner: "promesse de gain ou prix",
      employment: "schéma d'arnaque à l'emploi",
      tech_support: "schéma d'assistance technique",
      government: "usurpation gouvernementale",
      financial_phishing: "schéma de phishing financier",
      romance: "schéma d'arnaque sentimentale",
      investment: "schéma de fraude à l'investissement",
    } as Record<string, string>,
    narrativeGuidance: {
      delivery_scam: "Les fausses livraisons demandent souvent des frais — vérifiez avec le vrai transporteur.",
      employment_scam: "Vérifiez les offres sur le site officiel de l’entreprise.",
      government_impersonation: "Les vrais organismes ne demandent pas votre NAS ni un paiement par texto.",
      account_verification: "N’utilisez pas le lien du message — connectez-vous seulement via l’app ou le site habituel.",
      recovery_scam: "Qui promet de récupérer votre argent contre des frais est souvent une autre arnaque.",
      financial_phishing: "Évitez les liens du message — utilisez le site ou l’app officiel.",
      prize_scam: "Les vrais gains ne vous demandent pas d’avancer de l’argent.",
      reward_claim: "Les vrais gains ne vous demandent pas d’avancer de l’argent.",
      tech_support: "Le vrai support ne vous appelle pas au hasard.",
      romance_scam: "Méfiez-vous des demandes d’argent en ligne.",
      investment_fraud: "Méfiez-vous des rendements « garantis » et de la pression.",
      law_enforcement: "La police ne réclame pas d’argent par texto.",
      social_engineering_opener: "Ça peut être une accroche avant une demande d’argent ou d’infos.",
      unknown: "Si ça vous semble bizarre, faites une pause et vérifiez.",
    },
  },
};

/* ---------- Link artifact (intel_features.link_artifact) — client-side only ---------- */

type ParsedLinkArtifact = {
  url?: string;
  domain: string | null;
  root_domain: string | null;
  tld: string | null;
  is_shortened: boolean;
  is_ip_address: boolean;
  has_suspicious_tld: boolean;
  /** From link_intel.expansion when present. */
  expansion_status: "expanded" | "failed" | "timeout" | "skipped" | null;
  final_root_domain: string | null;
};

function parseLinkArtifactLegacy(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  const raw = intel.link_artifact;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    url: typeof a.url === "string" ? a.url : undefined,
    domain: typeof a.domain === "string" ? a.domain : null,
    root_domain: typeof a.root_domain === "string" ? a.root_domain : null,
    tld: typeof a.tld === "string" ? a.tld : null,
    is_shortened: Boolean(a.is_shortened),
    is_ip_address: Boolean(a.is_ip_address),
    has_suspicious_tld: Boolean(a.has_suspicious_tld),
    expansion_status: null,
    final_root_domain: null,
  };
}

/** Preferred: intel_features.link_intel (v1), including expansion when present. */
function parseLinkIntelV1(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  const raw = intel.link_intel;
  if (!raw || typeof raw !== "object") return null;
  const li = raw as Record<string, unknown>;
  if (li.version !== 1) return null;
  const p = li.primary;
  if (!p || typeof p !== "object") return null;
  const pr = p as Record<string, unknown>;
  const flags = pr.flags && typeof pr.flags === "object" ? (pr.flags as Record<string, unknown>) : null;
  let expansion_status: ParsedLinkArtifact["expansion_status"] = null;
  let final_root_domain: string | null = null;
  const exp = li.expansion;
  if (exp && typeof exp === "object" && "status" in exp) {
    const st = String((exp as { status: unknown }).status);
    if (st === "expanded" || st === "failed" || st === "timeout" || st === "skipped") {
      expansion_status = st;
    }
    if (expansion_status === "expanded") {
      const e = exp as Record<string, unknown>;
      const fr = typeof e.final_root_domain === "string" ? e.final_root_domain.trim() : "";
      const fd = typeof e.final_domain === "string" ? e.final_domain.trim() : "";
      final_root_domain = fr || fd || null;
    }
  }
  return {
    url: typeof pr.url === "string" ? pr.url : undefined,
    domain: typeof pr.domain === "string" ? pr.domain : null,
    root_domain: typeof pr.root_domain === "string" ? pr.root_domain : null,
    tld: typeof pr.tld === "string" ? pr.tld : null,
    is_shortened: Boolean(flags?.shortened),
    is_ip_address: Boolean(flags?.ip_host),
    has_suspicious_tld: Boolean(flags?.suspicious_tld),
    expansion_status,
    final_root_domain,
  };
}

function parseLinkArtifact(intel: Record<string, unknown>): ParsedLinkArtifact | null {
  return parseLinkIntelV1(intel) ?? parseLinkArtifactLegacy(intel);
}

type WebRiskUiStatus = "unsafe" | "unknown" | "skipped";
type InterpretationLine = {
  concept: InterpretationSurfaceConcept;
  text: string;
};

type AbuseInterpretationUi = {
  riskCard: InterpretationLine[];
  whyFlagged: InterpretationLine[];
  nextStep: InterpretationLine[];
};

function normalizeBrandLabel(claim: string): string {
  const map: Record<string, string> = {
    serviceontario: "ServiceOntario",
    cra: "CRA / Service Canada",
    canadapost: "Canada Post",
    interac: "Interac",
    intelcom: "Intelcom",
    microsoft: "Microsoft",
    amazon: "Amazon",
    paypal: "PayPal",
    roblox: "Roblox",
    costco: "Costco",
    bell: "Bell",
    icbc: "ICBC",
    fedex: "FedEx",
    dhl: "DHL",
    purolator: "Purolator",
  };
  return map[claim] ?? claim;
}

function buildInterpretationUiLines(
  abuse: ParsedAbuseInterpretationForSurface | null,
  lang: "en" | "fr",
  risk: "low" | "medium" | "high"
): AbuseInterpretationUi {
  if (!abuse) return { riskCard: [], whyFlagged: [], nextStep: [] };
  const riskCard: InterpretationLine[] = [];
  const whyFlagged: InterpretationLine[] = [];
  const nextStep: InterpretationLine[] = [];
  const line = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const brandClaimRaw = abuse.brandClaim ?? "";
  const brandLabel = brandClaimRaw ? normalizeBrandLabel(brandClaimRaw) : "this service";
  const conceptSet = new Set(abuse.concepts);

  for (const concept of abuse.concepts) {
    if (concept === "behaviorInfraCombo") {
      riskCard.push({
        concept,
        text: line(
          "This message combines a request for action with a risky link pattern.",
          "Ce message combine une demande d'action et un modèle de lien risqué."
        ),
      });
      whyFlagged.push({
        concept,
        text: line(
          "Action intent and link risk signals appear together in this message.",
          "L'intention d'action et les signaux de risque du lien apparaissent ensemble dans ce message."
        ),
      });
    } else if (concept === "brandMismatch") {
      riskCard.push({
        concept,
        text: line(
          `This link does not use an official ${brandLabel} domain.`,
          `Ce lien n'utilise pas un domaine officiel de ${brandLabel}.`
        ),
      });
      whyFlagged.push({
        concept,
        text: line(
          `The message claims to be from ${brandLabel}, but the link is not on an official ${brandLabel} website.`,
          `Le message prétend venir de ${brandLabel}, mais le lien n'est pas sur un site officiel de ${brandLabel}.`
        ),
      });
    } else if (concept === "hiddenDestination") {
      riskCard.push({
        concept,
        text: line(
          "This link hides its final destination.",
          "Ce lien masque sa destination finale."
        ),
      });
      whyFlagged.push({
        concept,
        text: line(
          "The destination is hidden behind a shortened or wrapped link.",
          "La destination est masquée derrière un lien raccourci ou enveloppé."
        ),
      });
    } else if (concept === "freeHosting") {
      riskCard.push({
        concept,
        text: line(
          "This link uses a free website platform often seen in phishing pages.",
          "Ce lien utilise une plateforme gratuite souvent vue dans des pages d'hameçonnage."
        ),
      });
      whyFlagged.push({
        concept,
        text: line(
          "The linked page uses disposable-style hosting not typical for official account requests.",
          "La page liée utilise un hébergement peu typique des demandes de compte officielles."
        ),
      });
    } else if (concept === "suspiciousTld") {
      riskCard.push({
        concept,
        text: line(
          "This link uses an unusual domain ending not typically used by official services.",
          "Ce lien utilise une terminaison de domaine inhabituelle, rarement utilisée par des services officiels."
        ),
      });
    } else if (concept === "suspiciousStructure") {
      riskCard.push({
        concept,
        text: line(
          "This link structure looks unusual for a normal service request.",
          "La structure de ce lien semble inhabituelle pour une demande de service normale."
        ),
      });
    }
  }

  if (conceptSet.has("behaviorInfraCombo")) {
    nextStep.push({
      concept: "verifyOfficialChannel",
      text: line(
        "Verify this request through the official website or app instead of this link.",
        "Vérifiez cette demande via le site ou l'application officielle plutôt qu'avec ce lien."
      ),
    });
  } else if (conceptSet.has("brandMismatch") || abuse.riskBoostFloor === "high") {
    nextStep.push({
      concept: "verifyOfficialChannel",
      text: line(
        "Do not log in or enter payment details through the linked page.",
        "N'entrez pas vos identifiants ni vos paiements via la page liée."
      ),
    });
  } else if (conceptSet.has("hiddenDestination") || conceptSet.has("freeHosting") || conceptSet.has("suspiciousTld")) {
    nextStep.push({
      concept: "verifyOfficialChannel",
      text: line(
        "Open the official service manually in your browser to confirm this request.",
        "Ouvrez le service officiel manuellement dans votre navigateur pour confirmer cette demande."
      ),
    });
  }

  if (
    risk === "medium" &&
    !conceptSet.has("behaviorInfraCombo") &&
    (conceptSet.has("hiddenDestination") || conceptSet.has("freeHosting") || conceptSet.has("suspiciousTld"))
  ) {
    riskCard.unshift({
      concept: "behaviorInfraCombo",
      text: line(
        "This message combines a prompt to click with an untrusted link pattern.",
        "Ce message combine une incitation à cliquer avec un modèle de lien non fiable."
      ),
    });
  }

  return { riskCard, whyFlagged, nextStep };
}

function linkWebRiskStatusFromIntel(intel: Record<string, unknown>): WebRiskUiStatus | null {
  try {
    const raw = intel.link_intel;
    if (!raw || typeof raw !== "object") return null;
    const li = raw as Record<string, unknown>;
    const wr = li.web_risk;
    if (!wr || typeof wr !== "object") return null;
    const st = String((wr as { status?: unknown }).status);
    if (st === "unsafe" || st === "unknown" || st === "skipped") return st as WebRiskUiStatus;
    return null;
  } catch {
    return null;
  }
}

function linkSurfaceLines(
  link: ParsedLinkArtifact,
  lang: "en" | "fr"
): { line1: string; line2: string | null } {
  const t = copy[lang].linkIntel;
  const primaryHost = (link.root_domain || link.domain || "").trim();
  const expandedWithHost =
    link.is_shortened && link.expansion_status === "expanded" && Boolean(link.final_root_domain);
  if (expandedWithHost) {
    return {
      line1: t.surfaceShortenedExpandedSingle.replace("{host}", link.final_root_domain as string),
      line2: null,
    };
  }
  if (link.is_shortened) {
    return {
      line1: t.surfaceShortenedUnresolvedLine1,
      line2: t.surfaceShortenedUnresolvedLine2,
    };
  }
  if (primaryHost) {
    return { line1: t.surfaceNormalLink.replace("{host}", primaryHost), line2: null };
  }
  const fromUrl = link.url
    ? (link.url.replace(/^https?:\/\//i, "").split("/")[0] ?? "").trim()
    : "";
  return { line1: t.surfaceNormalLink.replace("{host}", fromUrl), line2: null };
}

/** Mirrors scan API heuristics for neutral “brand-like host” messaging (no network). */
const BRAND_LIKE_HOST_SUBSTRINGS_UI =
  /paypal|amazon|microsoft|apple|google|netflix|chase|wells\s*fargo|desjardins|interac|bank\s*of\s*america|citibank|scotiabank|tdbank|bmo\b/i;

const OFFICIAL_BRAND_ROOT_UI =
  /^(paypal|amazon|microsoft|apple|google|netflix|desjardins|chase|wellsfargo)\.(com|ca|co\.uk|net|org)(\.[a-z]{2})?$/i;

function extractPhoneSnippet(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.trim().match(/\+?\d[\d\s().-]{6,}\d/);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

function hostnameMayMimicBrand(domain: string | null, root: string | null): boolean {
  if (!domain || !root) return false;
  const d = domain.toLowerCase();
  const r = root.toLowerCase().replace(/^www\./, "");
  if (!BRAND_LIKE_HOST_SUBSTRINGS_UI.test(d)) return false;
  if (OFFICIAL_BRAND_ROOT_UI.test(r)) return false;
  return true;
}

/** Strip scan-API link-fragment action clauses so the UI line below owns “before clicking” guidance. */
function stripLinkOnlyActionFromSummary(text: string, lang: "en" | "fr"): string {
  const t = text.trim();
  if (lang === "fr") {
    return t
      .replace(/\s+Vérifiez la destination avant de cliquer\.?$/iu, "")
      .replace(/\s+Vérifiez attentivement la destination avant de cliquer\.?$/iu, "")
      .replace(
        /\s+Assurez-vous que l['\u2019]adresse correspond au site officiel avant de cliquer\.?$/iu,
        ""
      )
      .trim();
  }
  return t
    .replace(/\s+Verify the destination before clicking\.?$/i, "")
    .replace(/\s+Verify the destination carefully before clicking\.?$/i, "")
    .replace(/\s+Confirm the address matches the official website before clicking\.?$/i, "")
    .trim();
}

/**
 * Plain-language summary when intel slots are concrete; otherwise returns null (caller uses API summary).
 */
function buildPlainSummaryFromIntel(
  intel: Record<string, unknown>,
  lang: "en" | "fr",
  risk: "low" | "medium" | "high"
): string | null {
  const action = String(intel.requested_action ?? "");
  const nf = String(intel.narrative_family ?? "");
  const nc = String(intel.narrative_category ?? "");
  const entity = String(intel.impersonation_entity ?? "");
  const state = String(intel.intel_state ?? "");

  if (state === "insufficient_context") return null;
  if (risk === "low" && (state === "no_signal" || state === "unknown")) return null;

  const enEntity: Record<string, string> = {
    cra: "may pretend to be the CRA",
    service_canada: "may pretend to be Service Canada",
    rcmp: "may pretend to be the RCMP",
    canada_post: "may pretend to be Canada Post",
    wealthsimple: "may pretend to be Wealthsimple",
    generic_government: "may pretend to be a government agency",
    generic_financial: "may pretend to be a bank or financial company",
    generic_courier: "may pretend to be a delivery company",
  };
  const frEntity: Record<string, string> = {
    cra: "pourrait imiter l’ARC",
    service_canada: "pourrait imiter Service Canada",
    rcmp: "pourrait imiter la GRC",
    canada_post: "pourrait imiter Postes Canada",
    wealthsimple: "pourrait imiter Wealthsimple",
    generic_government: "pourrait imiter un organisme gouvernemental",
    generic_financial: "pourrait imiter une banque ou une institution financière",
    generic_courier: "pourrait imiter un service de livraison",
  };
  const entMap = lang === "fr" ? frEntity : enEntity;

  if (lang === "en") {
    let core = "";
    if (action === "submit_credentials") {
      core = "This message requests account verification details.";
    } else if (action === "pay_money" && (nf === "delivery_scam" || nc === "delivery_scam")) {
      core = "This message requests a delivery-related payment.";
    } else if (action === "pay_money") {
      core = "This message requests payment.";
    } else if ((nf === "reward_claim" || nc === "prize_scam") && action === "click_link") {
      core = "This message prompts you to click a link to claim a reward.";
    } else if (action === "click_link") {
      core =
        risk === "low"
          ? "This message includes a link but no strong indicators of manipulation."
          : "This message prompts you to click a link.";
    } else if (action === "call_number") {
      core = "This message prompts you to call a number.";
    } else {
      return null;
    }
    if (entity !== "unknown" && entMap[entity]) {
      if (risk === "high" && action === "pay_money") {
        core = `This message requests payment and appears to impersonate ${entMap[entity].replace(/^may pretend to be /, "")}.`;
      } else {
        core = core.replace(/\.$/, "") + ` It ${entMap[entity]}.`;
      }
    }
    return core;
  }

  let coreFr = "";
  if (action === "submit_credentials") {
    coreFr = "Ce message demande des informations de vérification de compte.";
  } else if (action === "pay_money" && (nf === "delivery_scam" || nc === "delivery_scam")) {
    coreFr = "Ce message demande un paiement lié à une livraison.";
  } else if (action === "pay_money") {
    coreFr = "Ce message demande un paiement.";
  } else if ((nf === "reward_claim" || nc === "prize_scam") && action === "click_link") {
    coreFr = "Ce message incite à cliquer sur un lien pour réclamer un prix.";
  } else if (action === "click_link") {
    coreFr =
      risk === "low"
        ? "Ce message contient un lien sans indicateurs forts de manipulation."
        : "Ce message incite à cliquer sur un lien.";
  } else if (action === "call_number") {
    coreFr = "Ce message incite à appeler un numéro.";
  } else {
    return null;
  }
  if (entity !== "unknown" && entMap[entity]) {
    coreFr = coreFr.replace(/\.$/, "") + ` Il ou elle ${entMap[entity]}.`;
  }
  return coreFr;
}

function highRiskLinkLine(
  link: ParsedLinkArtifact,
  intel: Record<string, unknown>,
  lang: "en" | "fr",
  risk: "low" | "medium" | "high"
): string | null {
  if (risk !== "high") return null;
  const entity = String(intel.impersonation_entity ?? "");
  const action = String(intel.requested_action ?? "");
  const suspiciousDomain = link.has_suspicious_tld || hostnameMayMimicBrand(link.domain, link.root_domain);
  const paymentOrCredential = action === "pay_money" || action === "submit_credentials";
  if (entity === "unknown" && !suspiciousDomain && !paymentOrCredential) return null;
  const host = (link.final_root_domain || link.root_domain || link.domain || "").trim();
  if (!host) return null;
  return lang === "fr"
    ? `Ce message redirige vers un domaine non officiel : ${host}.`
    : `This message directs you to a non-official domain: ${host}.`;
}

/* ---------- Risk Meter ---------- */

const RISK_CONFIG = {
  low: { percent: 30, color: "#16A34A", bgColor: "#E8F5EC" },
  medium: { percent: 60, color: "#D97706", bgColor: "#FDF6E8" },
  high: { percent: 90, color: "#DC2626", bgColor: "#FBEAEA" },
};

function RiskMeter({ risk, label, levelText }: { risk: "low" | "medium" | "high"; label: string; levelText: string }) {
  const config = RISK_CONFIG[risk];

  return (
    <div
      style={styles.meterContainer}
      role="meter"
      aria-valuenow={config.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div style={styles.meterTrack}>
        <div
          style={{
            ...styles.meterFillWrapper,
            width: `${config.percent}%`,
          }}
        >
          <div
            style={{
              ...styles.meterFill,
              backgroundColor: config.color,
            }}
          />
          <div
            style={{
              ...styles.meterMarker,
              backgroundColor: config.color,
            }}
          />
        </div>
      </div>
      <div className="text-xs text-gray-500" style={styles.riskLevelLine}>
        {levelText}
      </div>
    </div>
  );
}

export default function ResultView() {
  const routeParams = useParams();
  const router = useRouter();
  const routeScanId =
    typeof routeParams?.scanId === "string" && routeParams.scanId.trim().length > 0
      ? routeParams.scanId.trim()
      : null;

  const [result, setResult] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [resultLoading, setResultLoading] = useState(() => Boolean(routeScanId));
  const [resultLoadError, setResultLoadError] = useState<string | null>(null);
  const [partner, setPartner] = useState<{ slug: string; name: string; logoUrl?: string } | null>(null);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalationForm, setEscalationForm] = useState({
    name: "",
    company: "",
    role: "",
    client_note: "",
  });
  const [escalationStatus, setEscalationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [escalationErrorMessage, setEscalationErrorMessage] = useState<string | null>(null);
  const [contextMode, setContextMode] = useState<"required" | "suggested" | "hidden" | "light_followup">("hidden");
  const [contextTriggerReason, setContextTriggerReason] = useState<string>("none");
  const [contextText, setContextText] = useState("");
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [initialSubmissionText, setInitialSubmissionText] = useState<string | null>(null);
  const [weakGateBypass, setWeakGateBypass] = useState(false);
  /** recovery = loaded from GET /api/scan/get (shareable URL, fresh browser); session = live flow or sessionStorage. */
  const [viewSource, setViewSource] = useState<"session" | "recovery" | null>(null);
  const conversionFiredForScanRef = useRef<string | null>(null);
  const shownRefinementOnceRef = useRef(new Set<string>());

  /* ---------- load scan result and partner mode ---------- */

  useEffect(() => {
    let cancelled = false;

    function applyHydrationSideEffects(parsed: Record<string, unknown>) {
      const parsedScanId = parsed.scan_id ? String(parsed.scan_id) : "";
      const draftRaw = parsedScanId
        ? sessionStorage.getItem(`context_refinement_draft:${parsedScanId}`)
        : null;
      let loadedContextFromDraft = false;
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          if (draft && typeof draft.text === "string" && Number(draft.expires_at ?? 0) > Date.now()) {
            setContextText(draft.text);
            loadedContextFromDraft = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (!loadedContextFromDraft && parsedScanId) {
        const lastCtx = sessionStorage.getItem(`context_refinement_last:${parsedScanId}`);
        const intelRefined = parsed?.intel_features && typeof parsed.intel_features === "object" && (parsed.intel_features as { context_refined?: boolean }).context_refined === true;
        if (intelRefined && typeof lastCtx === "string" && lastCtx.length > 0) {
          setContextText(lastCtx);
        }
      }

      const riskTier = (parsed.risk ?? parsed.risk_tier ?? "low") as string;
      const key = parsedScanId ? `scan_shown:${parsedScanId}` : null;
      if (parsedScanId && key && !firedOnce.has(key)) {
        firedOnce.add(key);
        let attrProps: Record<string, string> = {};
        try {
          const storedAttr = sessionStorage.getItem("scan_attribution");
          if (storedAttr) attrProps = JSON.parse(storedAttr);
        } catch {
          /* ignore */
        }
        logScanEvent("scan_shown", {
          scan_id: parsedScanId,
          props: { risk_tier: riskTier, ...attrProps },
        });
      }
      if (parsedScanId && conversionFiredForScanRef.current !== parsedScanId) {
        conversionFiredForScanRef.current = parsedScanId;
        trackConversion("AW-16787240010/-lHQCNrulP0bEMro48Q-");
      }
    }

    async function run() {
      try {
        const params = new URLSearchParams(window.location.search);
        const l = params.get("lang");
        const nextLang: "en" | "fr" = l === "fr" ? "fr" : "en";
        if (!cancelled) setLang(nextLang);

        const partnerSlug =
          params.get("partner")?.trim() || sessionStorage.getItem("scan_partner")?.trim() || null;
        if (partnerSlug) {
          const p = getPartnerBySlug(partnerSlug);
          if (p && p.active) {
            setPartner({ slug: p.slug, name: p.name, logoUrl: p.logoUrl });
          }
        }

        let storedParsed: Record<string, unknown> | null = null;
        const stored = sessionStorage.getItem("scanResult");
        if (stored) {
          try {
            storedParsed = JSON.parse(stored) as Record<string, unknown>;
          } catch {
            storedParsed = null;
          }
        }

        const storedScanId = storedParsed?.scan_id != null ? String(storedParsed.scan_id) : "";

        if (routeScanId) {
          if (storedScanId && storedScanId === routeScanId && storedParsed) {
            if (!cancelled) {
              setResult(storedParsed);
              setViewSource("session");
              setResultLoadError(null);
              setResultLoading(false);
              applyHydrationSideEffects(storedParsed);
            }
          } else {
            if (!cancelled) {
              setResultLoading(true);
              setResultLoadError(null);
            }
            try {
              const res = await fetch(`/api/scan/get?scan_id=${encodeURIComponent(routeScanId)}`);
              const data = await res.json();
              if (cancelled) return;
              if (data?.ok && data?.result) {
                setResult(data.result);
                sessionStorage.setItem("scanResult", JSON.stringify(data.result));
                setViewSource("recovery");
                setResultLoadError(null);
                applyHydrationSideEffects(data.result as Record<string, unknown>);
              } else {
                setResult(null);
                setResultLoadError(
                  nextLang === "fr"
                    ? "Ce résultat est introuvable ou le lien n'est plus valide."
                    : "This result could not be found or the link is no longer valid."
                );
                logScanEvent("scan_error", {
                  props: { error_code: "result_recovery_failed" },
                });
              }
            } catch {
              if (!cancelled) {
                setResult(null);
                setResultLoadError(
                  nextLang === "fr"
                    ? "Impossible de charger ce résultat pour le moment."
                    : "Could not load this result right now."
                );
                logScanEvent("scan_error", {
                  props: { error_code: "result_recovery_failed" },
                });
              }
            } finally {
              if (!cancelled) setResultLoading(false);
            }
          }
        } else if (storedParsed) {
          if (!cancelled) {
            setResult(storedParsed);
            setViewSource("session");
            setResultLoadError(null);
            applyHydrationSideEffects(storedParsed);
          }
        }

        const storedSubmission = sessionStorage.getItem("scan_submission");
        if (storedSubmission) {
          try {
            const parsedSubmission = JSON.parse(storedSubmission) as { text?: string; source?: string };
            if (parsedSubmission.source === "user_text" && typeof parsedSubmission.text === "string") {
              setInitialSubmissionText(parsedSubmission.text);
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) setResult(null);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [routeScanId]);

  const t = copy[lang];
  const risk: "low" | "medium" | "high" = result?.risk ?? result?.risk_tier ?? "low";
  const intel = result?.intel_features ?? {};
  const scanIdForContext = result?.scan_id ? String(result.scan_id) : "";
  const inputType = String(intel.input_type ?? "unknown");
  const contextQuality = String(intel.context_quality ?? "unknown");
  const intelState = String(intel.intel_state ?? "unknown");
  const submissionRoute = String(intel.submission_route ?? "");
  const knownCoreCount = Number(intel.known_core_dimension_count ?? 0);
  const wasRefined = intel.context_refined === true;
  const dataQuality = result?.data_quality as { url_only?: boolean } | undefined;
  const urlOnlyFlag = Boolean(dataQuality?.url_only);

  const weakInputShape =
    inputType === "link_only" || inputType === "phone_only" || inputType === "fragment";

  const fragmentaryContext = ["thin", "fragment", "unknown"].includes(contextQuality);
  const explicitInsufficient =
    intelState === "insufficient_context" || submissionRoute === "insufficient_context";
  const weakMetadataGate =
    (intelState === "weak_signal" || explicitInsufficient) && fragmentaryContext;

  const weakInputGateEligible =
    Boolean(result) &&
    !wasRefined &&
    (weakInputShape || urlOnlyFlag || weakMetadataGate);

  const isRecoveryView = viewSource === "recovery";
  const weakInputGateActive =
    !isRecoveryView && weakInputGateEligible && !weakGateBypass;

  const scanIdForBypassReset = result?.scan_id != null ? String(result.scan_id) : "";

  const showSuggestedRefinement =
    !weakInputGateActive &&
    !wasRefined &&
    (intelState === "insufficient_context" ||
      ["thin", "unknown", "fragment"].includes(contextQuality) ||
      knownCoreCount <= 1);

  const hasMeaningfulClassification =
    ["weak_signal", "structured_signal", "no_signal"].includes(intelState) ||
    knownCoreCount >= 2 ||
    (["partial", "full", "thin"].includes(contextQuality) &&
      submissionRoute !== "insufficient_context" &&
      intelState !== "insufficient_context");

  const showLightFollowUp = wasRefined && hasMeaningfulClassification;

  const resolvedContextMode: "required" | "suggested" | "hidden" | "light_followup" =
    weakInputGateActive
      ? "required"
      : showSuggestedRefinement
        ? "suggested"
        : showLightFollowUp
          ? "light_followup"
          : "hidden";

  const resolvedTriggerReason = showLightFollowUp
    ? "post_refinement_followup"
    : weakInputGateActive
      ? urlOnlyFlag && !weakInputShape
        ? "data_quality_url_only"
        : weakInputShape
          ? `weak_input_${inputType}`
          : "weak_metadata_fragmentary_context"
      : showSuggestedRefinement
        ? intelState === "insufficient_context"
          ? "intel_state_insufficient_context"
          : ["thin", "unknown", "fragment"].includes(contextQuality)
            ? `context_quality_${contextQuality}`
            : knownCoreCount <= 1
              ? "low_core_signal"
              : "suggested_misc"
        : "none";

  useEffect(() => {
    setContextMode(resolvedContextMode);
    setContextTriggerReason(resolvedTriggerReason);
  }, [resolvedContextMode, resolvedTriggerReason]);

  useEffect(() => {
    if (!scanIdForBypassReset) return;
    setWeakGateBypass(sessionStorage.getItem(`weak_input_gate_bypass:${scanIdForBypassReset}`) === "1");
  }, [scanIdForBypassReset]);

  useEffect(() => {
    if (!scanIdForContext) return;
    sessionStorage.setItem(
      `context_refinement_draft:${scanIdForContext}`,
      JSON.stringify({
        text: contextText,
        expires_at: Date.now() + 30 * 60 * 1000,
      })
    );
  }, [contextText, scanIdForContext]);

  useEffect(() => {
    if (!result || contextMode === "hidden" || !scanIdForContext) return;
    const key = `${scanIdForContext}:${contextMode}:${contextTriggerReason}`;
    if (shownRefinementOnceRef.current.has(key)) return;
    shownRefinementOnceRef.current.add(key);
    logScanEvent("context_refinement_shown", {
      scan_id: scanIdForContext,
      props: {
        mode: contextMode,
        trigger_reason: contextTriggerReason,
        input_type: inputType,
      },
    });
  }, [contextMode, contextTriggerReason, scanIdForContext, inputType, result]);

  const openPartnerEscalationForm = useCallback(() => {
    const ctx =
      typeof intel.user_context_text === "string" && intel.user_context_text.trim().length > 0
        ? intel.user_context_text.trim()
        : "";
    setEscalationForm((prev) => ({
      ...prev,
      client_note: ctx ? ctx : prev.client_note,
    }));
    setShowEscalationForm(true);
  }, [intel.user_context_text]);

  function isMeaningfulContext(v: string): boolean {
    const cleaned = v.replace(/[\s`'"()[\]{}<>.,;:!?-]/g, "");
    return cleaned.length >= 8;
  }

  function charLenBucket(v: string): string {
    const n = v.trim().length;
    if (n < 20) return "8_19";
    if (n < 60) return "20_59";
    if (n < 140) return "60_139";
    return "140_plus";
  }

  const submitContextRefinement = async () => {
    if (!result) return;
    if (!isMeaningfulContext(contextText)) {
      setContextError("Please add a bit more context so we can continue analysis.");
      return;
    }
    if (!initialSubmissionText || initialSubmissionText.trim().length === 0) {
      setContextError("Original submission is unavailable for refinement.");
      return;
    }
    setContextError(null);
    setContextLoading(true);

    try {
      logScanEvent("context_refinement_submitted", {
        scan_id: scanIdForContext || undefined,
        props: {
          mode: contextMode,
          input_type: inputType,
          char_len_bucket: charLenBucket(contextText),
        },
      });

      const refinementNonce = crypto.randomUUID();
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: initialSubmissionText,
          lang,
          raw_opt_in: true,
          analysis_mode: "refined",
          user_context_text: contextText.trim(),
          refinement_nonce: refinementNonce,
          refinement_parent_scan_id: scanIdForContext || null,
        }),
      });
      const data = await res.json();
      if (!data?.ok || !data?.result) {
        setContextError("We couldn't refine this analysis right now. Please try again.");
        setContextLoading(false);
        return;
      }

      setResult(data.result);
      sessionStorage.setItem("scanResult", JSON.stringify(data.result));
      const refinedText = contextText.trim();
      if (scanIdForContext) {
        sessionStorage.setItem(`context_refinement_last:${scanIdForContext}`, refinedText);
        sessionStorage.removeItem(`context_refinement_draft:${scanIdForContext}`);
      }
      setContextText(refinedText);
      setContextLoading(false);
      const refinedId = data.result?.scan_id != null ? String(data.result.scan_id) : "";
      if (refinedId) {
        const qs = new URLSearchParams();
        qs.set("lang", lang);
        if (partner) qs.set("partner", partner.slug);
        router.replace(`/result/${refinedId}?${qs.toString()}`);
      }
      logScanEvent("context_refinement_completed_analysis", {
        scan_id: String((data.result.scan_id ?? scanIdForContext) || ""),
        props: {
          mode: contextMode,
          input_type: inputType,
        },
      });
    } catch {
      setContextError("We couldn't refine this analysis right now. Please try again.");
      setContextLoading(false);
    }
  };

  if (resultLoading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-gray-600">{lang === "fr" ? "Chargement…" : "Loading…"}</p>
      </main>
    );
  }

  if (resultLoadError) {
    return (
      <main className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-gray-800">{resultLoadError}</p>
        <a href={lang === "fr" ? "/scan?lang=fr" : "/scan"} className="text-blue-600 underline">
          {lang === "fr" ? "Retour à l’analyse" : "Back to scanner"}
        </a>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-gray-800">
          {lang === "fr"
            ? "Aucun résultat à afficher. Lancez une analyse depuis la page d’accueil."
            : "No result to show. Start a scan from the home page."}
        </p>
        <a href={lang === "fr" ? "/scan?lang=fr" : "/scan"} className="text-blue-600 underline">
          {lang === "fr" ? "Analyser un message" : "Scan a message"}
        </a>
      </main>
    );
  }

  const linkArtifact = parseLinkArtifact(intel as Record<string, unknown>);
  const linkWebRiskStatus = linkWebRiskStatusFromIntel(intel as Record<string, unknown>);
  const abuseInterpretation = parseAbuseInterpretationForSurface(intel as Record<string, unknown>);
  const linkDisplayDomain = linkArtifact ? linkArtifact.root_domain || linkArtifact.domain : null;

  const groundedReasons: string[] = (() => {
    const reasons: string[] = [];
    const gr = t.groundedReasons;
    const seen = new Set<string>();

    const add = (s: string) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        reasons.push(s);
      }
    };

    const route = intel.submission_route ?? "";
    const ctx = intel.context_quality ?? "";
    const narrative = intel.narrative_family ?? "";
    const entity = intel.impersonation_entity ?? "";
    const action = intel.requested_action ?? "";
    const threat = intel.threat_stage ?? "";

    if (
      (route === "insufficient_context" || ctx === "fragment") &&
      !(wasRefined && hasMeaningfulClassification)
    ) {
      add(gr.limited_context);
    }
    if (narrative && narrative !== "unknown" && gr.narrative[narrative]) {
      add(gr.narrative[narrative]);
    }
    if (entity && entity !== "unknown" && gr.entity[entity]) {
      add(gr.entity[entity]);
    }
    if (action && action !== "unknown" && action !== "none" && gr.action[action]) {
      add(gr.action[action]);
    }
    if (threat && threat !== "unclear" && gr.threat[threat]) {
      add(gr.threat[threat]);
    }

    return reasons;
  })();

  const narrativeGuidanceText: string | null = (() => {
    const narrative = intel.narrative_family ?? "";
    if (!narrative || narrative === "unknown") return null;
    const g = t.narrativeGuidance as Record<string, string>;
    return g[narrative] ?? null;
  })();

  const narrativeFamily = intel.narrative_family ?? "";
  const nextSteps = (t.narrativeNextSteps as Record<string, { action: string; explanation: string }[] | undefined>)?.[narrativeFamily] ?? t.guidance;
  const interpretationUi = buildInterpretationUiLines(abuseInterpretation, lang, risk);
  const usedInterpretationConcepts = new Set<InterpretationSurfaceConcept>();
  const consumeInterpretation = (lines: InterpretationLine[], limit: number): string[] => {
    const out: string[] = [];
    for (const l of lines) {
      if (out.length >= limit) break;
      if (usedInterpretationConcepts.has(l.concept)) continue;
      usedInterpretationConcepts.add(l.concept);
      out.push(l.text);
    }
    return out;
  };
  const riskCardInterpretationLines = consumeInterpretation(interpretationUi.riskCard, 2);
  const whyFlaggedInterpretationLines = consumeInterpretation(interpretationUi.whyFlagged, 2);
  const nextStepInterpretationLines = consumeInterpretation(interpretationUi.nextStep, 1);

  const summaryRaw = result.summary_sentence || t.defaultSummary[risk];
  const apiSummary = linkArtifact ? stripLinkOnlyActionFromSummary(summaryRaw, lang) : summaryRaw;
  const plainSummary = buildPlainSummaryFromIntel(intel as Record<string, unknown>, lang, risk);
  let summary = plainSummary ?? apiSummary;
  const hasMediumLinkInterpretation =
    risk === "medium" &&
    Boolean(abuseInterpretation) &&
    (abuseInterpretation?.concepts.includes("hiddenDestination") ||
      abuseInterpretation?.concepts.includes("freeHosting") ||
      abuseInterpretation?.concepts.includes("suspiciousTld"));
  if (
    abuseInterpretation?.concepts.includes("behaviorInfraCombo") ||
    hasMediumLinkInterpretation
  ) {
    const clickLikeEn = /^This message prompts you to click a link\.?$/i;
    const clickLikeFr = /^Ce message incite à cliquer sur un lien\.?$/i;
    if ((lang === "en" && clickLikeEn.test(summary)) || (lang === "fr" && clickLikeFr.test(summary))) {
      summary =
        lang === "fr"
          ? "Ce message combine une incitation à cliquer avec un modèle de lien non fiable."
          : "This message combines a prompt to click with an untrusted link pattern.";
    }
  }

  const confidence: "low" | "medium" | "high" =
    result.intel_features?.confidence_level ?? "low";
  const confidenceText =
    ["low", "medium", "high"].includes(confidence)
      ? t.confidenceLevel[confidence]
      : t.confidenceLevel.low;
  const confidenceHelperText =
    ["low", "medium", "high"].includes(confidence)
      ? t.confidenceHelper[confidence]
      : t.confidenceHelper.low;

  const riskBlockStyle = {
    ...styles.riskBlock,
    backgroundColor: RISK_CONFIG[risk].bgColor,
    border: "1px solid #D1D5DB",
  };

  const tierColor =
    risk === "low" ? "#15803D" : risk === "medium" ? "#B45309" : "#B91C1C";

  const ri = t.refinementIncomplete;
  const wg = t.weakInputGate;
  const phoneSnippet = extractPhoneSnippet(initialSubmissionText);
  const showGateLinkLine = Boolean(linkArtifact && linkDisplayDomain);
  const showGatePhoneLine =
    Boolean(phoneSnippet) &&
    (inputType === "phone_only" || Boolean(intel.callback_number_present));

  const contextRefinementDisplay: ContextRefinementStrings = partner
    ? t.contextRefinementPartner
    : t.contextRefinement;

  const weakGateRefinementStrings: ContextRefinementStrings = {
    ...contextRefinementDisplay,
    placeholder: partner ? wg.gatePlaceholderPartner : wg.gatePlaceholderPublic,
  };
  const weakGateExampleSingle =
    inputType === "phone_only"
      ? partner
        ? wg.gateExamplePartnerPhone
        : wg.gateExamplePublicPhone
      : partner
        ? wg.gateExamplePartner
        : wg.gateExamplePublic;

  const prioritizePartnerEscalation =
    Boolean(partner) && (risk === "medium" || risk === "high");

  const renderPartnerEscalationSuccess = () => (
    <div style={styles.escalationSuccessBlock}>
      <p className="text-sm" style={styles.escalationSuccessText}>
        {t.escalationForm.successMessage}
      </p>
    </div>
  );

  const renderPartnerEscalationForm = () => (
    <div style={styles.escalationFormShell}>
      <div style={styles.escalationFormHeader}>
        <h3 className="text-sm font-semibold text-gray-900" style={styles.escalationFormTitle}>
          {t.escalationForm.title}
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowEscalationForm(false);
            setEscalationErrorMessage(null);
          }}
          style={styles.mspCloseButton}
        >
          {t.mspCloseForm}
        </button>
      </div>
      <div style={styles.escalationFormBlock} className="gap-4">
        {escalationStatus === "error" && escalationErrorMessage && (
          <p className="text-sm" style={styles.escalationError} role="alert">
            {escalationErrorMessage}
          </p>
        )}
        <div style={styles.escalationFormFields} className="gap-4">
          <label className="text-sm font-medium text-gray-700" style={styles.escalationLabel}>
            {t.escalationForm.nameLabel} <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={escalationForm.name}
            onChange={(e) => setEscalationForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t.escalationForm.namePlaceholder}
            style={styles.escalationInput}
            className="result-escalation-field text-sm"
            autoComplete="name"
          />
          <label className="text-sm font-medium text-gray-700" style={styles.escalationLabel}>
            {t.escalationForm.companyLabel} <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={escalationForm.company}
            onChange={(e) => setEscalationForm((f) => ({ ...f, company: e.target.value }))}
            placeholder={t.escalationForm.companyPlaceholder}
            style={styles.escalationInput}
            className="result-escalation-field text-sm"
            autoComplete="organization"
          />
          <label className="text-sm font-medium text-gray-700" style={styles.escalationLabel}>
            {t.escalationForm.roleLabel}
          </label>
          <input
            type="text"
            value={escalationForm.role}
            onChange={(e) => setEscalationForm((f) => ({ ...f, role: e.target.value }))}
            placeholder={t.escalationForm.rolePlaceholder}
            style={styles.escalationInput}
            className="result-escalation-field text-sm"
            autoComplete="organization-title"
          />
          <label className="text-sm font-medium text-gray-700" style={styles.escalationLabel}>
            {t.escalationForm.noteLabel}
          </label>
          <span className="text-xs text-gray-500" style={styles.escalationHelper}>
            {t.escalationForm.noteHelper}
          </span>
          <textarea
            value={escalationForm.client_note}
            onChange={(e) => setEscalationForm((f) => ({ ...f, client_note: e.target.value }))}
            placeholder={t.escalationForm.notePlaceholder}
            style={styles.escalationTextarea}
            className="result-escalation-field text-sm"
            rows={3}
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-gray-500" style={styles.escalationSubmissionInfo}>
          {t.escalationForm.submissionInfo}
        </p>
        <div style={styles.escalationFormActions}>
          <button
            type="button"
            disabled={
              !escalationForm.name.trim() ||
              !escalationForm.company.trim() ||
              !result.scan_id ||
              escalationStatus === "loading"
            }
            style={{
              ...styles.escalationSubmitButton,
              ...((!escalationForm.name.trim() ||
                !escalationForm.company.trim() ||
                !result.scan_id ||
                escalationStatus === "loading") && {
                opacity: 0.6,
                cursor: "not-allowed",
              }),
            }}
            onMouseEnter={(e) => {
              if ((e.currentTarget as HTMLButtonElement).disabled) return;
              e.currentTarget.style.filter = "brightness(0.95)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
            onClick={async () => {
              if (!result.scan_id || !partner) return;
              setEscalationStatus("loading");
              setEscalationErrorMessage(null);
              try {
                const res = await fetch("/api/partner-escalation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    scan_id: result.scan_id,
                    partner_slug: partner.slug,
                    user_name: escalationForm.name.trim(),
                    user_company: escalationForm.company.trim(),
                    user_role: (escalationForm.role ?? "").trim() || null,
                    client_note: (escalationForm.client_note ?? "").trim() || null,
                  }),
                });
                let data: { ok?: boolean; message?: string } = {};
                try {
                  const text = await res.text();
                  if (text) data = JSON.parse(text) as { ok?: boolean; message?: string };
                } catch {
                  setEscalationStatus("error");
                  setEscalationErrorMessage(t.escalationForm.errorMessage);
                  return;
                }
                if (res.ok && data.ok === true) {
                  setEscalationStatus("success");
                } else {
                  setEscalationStatus("error");
                  setEscalationErrorMessage(data.message ?? t.escalationForm.errorMessage);
                }
              } catch {
                setEscalationStatus("error");
                setEscalationErrorMessage(t.escalationForm.errorMessage);
              }
            }}
          >
            {escalationStatus === "loading"
              ? t.escalationForm.sending
              : t.escalationForm.submitButton}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPartnerEscalationResultTrigger = () => {
    if (!partner || showEscalationForm || escalationStatus === "success") return null;
    if (prioritizePartnerEscalation) {
      return (
        <>
          <p style={styles.mspBelowCardHint}>{t.mspBelowCardHint}</p>
          <button
            type="button"
                       onClick={openPartnerEscalationForm}
            style={styles.primaryMspCtaButton}
          >
            {t.mspTrigger}
          </button>
          <p style={styles.mspPromotedSupporting}>{t.mspPromotedSupporting}</p>
        </>
      );
    }
    return (
      <button type="button" onClick={openPartnerEscalationForm} style={styles.mspTrigger}>
        {t.mspTrigger}
      </button>
    );
  };

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        {/* ---------- Top Nav ---------- */}
        <div style={styles.topNav}>
          <a href={`/?lang=${lang}`} style={styles.backLink} className="text-sm font-medium">
            {t.backHome}
          </a>
        </div>

        {/* ---------- Partner mode: name, logo, trust line ---------- */}
        {partner && (
          <div style={styles.partnerHeader}>
            {partner.logoUrl && (
              <img src={partner.logoUrl} alt={`${partner.name} logo`} style={styles.partnerLogo} />
            )}
            <p className="text-base font-semibold text-gray-900" style={styles.partnerBrandingPrimary}>
              {partner.name}
              {t.partnerBrandingRole}
            </p>
            <p className="text-xs text-gray-500" style={styles.partnerPoweredBy}>
              {t.poweredByScanScam}
            </p>
          </div>
        )}

        {weakInputGateActive ? (
          <div style={styles.weakInputGateBlock}>
            <h2 style={styles.weakGateHeading}>{wg.heading}</h2>
            <p style={styles.weakGateBody}>{wg.bodyLine1}</p>
            <p style={styles.weakGateBodySecondary}>
              {partner ? wg.bodyLine2Partner : wg.bodyLine2Public}
            </p>
            {showGateLinkLine && linkArtifact && (
              <div style={styles.weakGateArtifact}>
                {(() => {
                  const ls = linkSurfaceLines(linkArtifact, lang);
                  const highRiskLine = highRiskLinkLine(
                    linkArtifact,
                    intel as Record<string, unknown>,
                    lang,
                    risk
                  );
                  return (
                    <>
                      <p className="text-sm leading-normal text-gray-900">{highRiskLine ?? ls.line1}</p>
                      {ls.line2 ? (
                        <p className="mt-1 text-sm leading-normal text-gray-900">{ls.line2}</p>
                      ) : null}
                      {linkWebRiskStatus ? (
                        <p
                          className={`mt-2 text-sm leading-normal ${linkWebRiskStatus === "unsafe" ? "font-semibold text-red-800" : "text-gray-900"}`}
                        >
                          {linkWebRiskStatus === "unsafe"
                            ? t.linkIntel.webRiskLineUnsafe
                            : linkWebRiskStatus === "unknown"
                              ? t.linkIntel.webRiskLineUnknown
                              : t.linkIntel.webRiskLineSkipped}
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            )}
            {showGatePhoneLine && (
              <div style={styles.weakGateArtifact}>
                <p className="text-xs text-gray-600">{wg.phoneDetectedLabel}</p>
                <p className="mt-0.5 font-semibold text-gray-900">{phoneSnippet}</p>
              </div>
            )}
            <div style={styles.weakGateRefinementWrap}>
            <ContextRefinementCard
              mode="required"
              compact
              gateProminentInput
              strings={weakGateRefinementStrings}
              exampleSingle={weakGateExampleSingle}
              collapsible={false}
              defaultExpanded
              value={contextText}
              onChange={(v) => {
                setContextText(v);
                if (contextError) setContextError(null);
              }}
              onSubmit={submitContextRefinement}
              loading={contextLoading}
              disabled={!isMeaningfulContext(contextText)}
              error={contextError}
            />
            </div>
            <button
              type="button"
              onClick={() => {
                if (scanIdForContext) {
                  sessionStorage.setItem(`weak_input_gate_bypass:${scanIdForContext}`, "1");
                }
                setWeakGateBypass(true);
              }}
              style={styles.weakGateSecondaryLink}
            >
              {wg.limitedAnalysisLink}
            </button>
            {partner ? (
              <div style={styles.weakGatePartnerEscalation}>
                {escalationStatus === "success" && renderPartnerEscalationSuccess()}
                {showEscalationForm && escalationStatus !== "success" && renderPartnerEscalationForm()}
                {!showEscalationForm && escalationStatus !== "success" && (
                  <button
                    type="button"
                    onClick={openPartnerEscalationForm}
                    style={styles.weakGateTertiaryLink}
                  >
                    {t.mspTrigger}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* ---------- A) Risk Block ---------- */}
            <div style={riskBlockStyle} className="gap-2">
              <div className="text-center text-xl font-semibold" style={{ color: tierColor }}>
                {t.tier[risk]}
              </div>
              <p className="text-center text-sm font-medium text-gray-700" style={styles.systemConfidenceLine}>
                {t.confidenceLabel} {confidenceText}
              </p>
              <p className="text-center text-xs text-gray-500" style={styles.systemConfidenceHelper}>
                {confidenceHelperText}
              </p>
              <RiskMeter
                risk={risk}
                label={t.tier[risk]}
                levelText={`${t.riskLevelLabel} ${t.riskLevel[risk]}`}
              />
              <p className="text-sm text-gray-900" style={styles.summary}>
                {summary}
              </p>
              {linkArtifact && (
                <div className="mt-3 text-sm leading-normal text-gray-900">
                  {(() => {
                    const ls = linkSurfaceLines(linkArtifact, lang);
                    const highRiskLine = highRiskLinkLine(
                      linkArtifact,
                      intel as Record<string, unknown>,
                      lang,
                      risk
                    );
                    return (
                      <>
                        <p className="text-sm leading-normal text-gray-900">{highRiskLine ?? ls.line1}</p>
                        {ls.line2 ? (
                          <p className="mt-1 text-sm leading-normal text-gray-900">{ls.line2}</p>
                        ) : null}
                        {linkWebRiskStatus ? (
                          <p
                            className={`mt-2 text-sm leading-normal ${linkWebRiskStatus === "unsafe" ? "font-semibold text-red-800" : "text-gray-900"}`}
                          >
                            {linkWebRiskStatus === "unsafe"
                              ? t.linkIntel.webRiskLineUnsafe
                              : linkWebRiskStatus === "unknown"
                                ? t.linkIntel.webRiskLineUnknown
                                : t.linkIntel.webRiskLineSkipped}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                  {(linkArtifact.has_suspicious_tld ||
                    hostnameMayMimicBrand(linkArtifact.domain, linkArtifact.root_domain)) && (
                    <ul className="mt-2 list-disc space-y-1 pl-[18px] text-xs leading-normal text-gray-600">
                      {linkArtifact.has_suspicious_tld && <li>{t.linkIntel.suspiciousTld}</li>}
                      {hostnameMayMimicBrand(linkArtifact.domain, linkArtifact.root_domain) && (
                        <li>{t.linkIntel.brandMimic}</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              {riskCardInterpretationLines.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-[18px] text-xs leading-normal text-gray-700">
                  {riskCardInterpretationLines.map((line, i) => (
                    <li key={`risk-ai-${i}`}>{line}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* ---------- Why this was flagged ---------- */}
            {(groundedReasons.length > 0 || whyFlaggedInterpretationLines.length > 0 || narrativeGuidanceText) && (
              <div style={styles.sectionDivider}>
                <div style={styles.reasonsBlock}>
                  <div style={styles.sectionEyebrow}>{t.whySuspicious}</div>
                  {(groundedReasons.length > 0 || whyFlaggedInterpretationLines.length > 0) && (
                    <ul className="mt-2 list-disc pl-[18px] text-sm text-gray-900 leading-snug" style={styles.reasons}>
                      {groundedReasons.slice(0, 3).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                      {whyFlaggedInterpretationLines.map((c, i) => (
                        <li key={`why-ai-${i}`}>{c}</li>
                      ))}
                    </ul>
                  )}
                  {narrativeGuidanceText && (
                    <p className="mt-2 text-xs text-gray-600 leading-snug" style={styles.narrativeGuidance}>
                      {narrativeGuidanceText}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ---------- What to do next + optional context + MSP ---------- */}
            <div style={{ ...styles.actionBlock, ...styles.sectionDivider }} className="gap-2">
              <div style={styles.sectionEyebrow}>{t.actionTitle}</div>
              <ul className="list-disc pl-4 text-sm text-gray-900" style={styles.actionList}>
                {nextSteps.map((g, i) => (
                  <li key={i} className="mb-2 last:mb-0">
                    <span className="font-medium text-gray-900">{g.action}</span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">{g.explanation}</span>
                  </li>
                ))}
                {nextStepInterpretationLines.map((line, i) => (
                  <li key={`next-ai-${i}`} className="mb-2 last:mb-0">
                    <span className="font-medium text-gray-900">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {partner ? (
              <>
                <div style={styles.partnerFlowDivider} />
                <div style={styles.mspPromotedSection}>
                  {escalationStatus === "success" && renderPartnerEscalationSuccess()}
                  {showEscalationForm && escalationStatus !== "success" && renderPartnerEscalationForm()}
                  {renderPartnerEscalationResultTrigger()}
                </div>
                <div style={styles.partnerFlowDivider} />
              </>
            ) : null}

            {contextMode === "suggested" && (
              <div style={{ ...styles.optionalBlock, ...styles.optionalRefinementAccent }}>
                <ContextRefinementCard
                  mode="suggested"
                  strings={contextRefinementDisplay}
                  exampleSingle={ri.examplesLink[0]}
                  collapsible
                  defaultExpanded={false}
                  value={contextText}
                  onChange={(v) => {
                    setContextText(v);
                    if (contextError) setContextError(null);
                  }}
                  onSubmit={submitContextRefinement}
                  loading={contextLoading}
                  disabled={!isMeaningfulContext(contextText)}
                  error={contextError}
                />
              </div>
            )}
          </>
        )}

        {showLightFollowUp && (
          <div style={styles.optionalBlock}>
            <ContextRefinementCard
              mode="suggested"
              strings={contextRefinementDisplay}
              tone="light"
              collapsible
              defaultExpanded={false}
              exampleSingle={null}
              value={contextText}
              onChange={(v) => {
                setContextText(v);
                if (contextError) setContextError(null);
              }}
              onSubmit={submitContextRefinement}
              loading={contextLoading}
              disabled={!isMeaningfulContext(contextText)}
              error={contextError}
            />
          </div>
        )}
      </section>

      {/* Page-level CTA below the result card (not inside the escalation flow) */}
      <div style={styles.belowCard}>
        {!weakInputGateActive && (
          <a
            href={partner ? `/partner/${partner.slug}?lang=${lang}` : `/scan?lang=${lang}`}
            className="text-sm font-semibold"
            style={
              prioritizePartnerEscalation && partner
                ? styles.scanAnotherSecondary
                : styles.scanAnotherButton
            }
          >
            {t.scanAnother}
          </a>
        )}
        <p className="text-xs text-gray-500" style={styles.footerAdvisory}>
          {t.footerAdvisory}
        </p>
      </div>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "calc(100vh - 156px)",
    backgroundColor: "#E2E4E9",
    color: "#0B1220",
    fontFamily: "Inter, system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px 16px",
    gap: 16,
  },
  belowCard: {
    width: "100%",
    maxWidth: "600px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  mspBelowCardHint: {
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  mspPromotedSupporting: {
    margin: 0,
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  primaryMspCtaButton: {
    display: "block",
    padding: "14px 24px",
    borderRadius: 12,
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    width: "100%",
    textAlign: "center" as const,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },
  scanAnotherSecondary: {
    display: "block",
    padding: "12px 24px",
    borderRadius: 12,
    border: "1px solid #D1D5DB",
    background: "#FFFFFF",
    color: "#6B7280",
    cursor: "pointer",
    width: "100%",
    textAlign: "center" as const,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    boxSizing: "border-box" as const,
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#F3F4F6",
    borderRadius: "14px",
    padding: "16px 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    boxShadow: "0 16px 48px rgba(11,18,32,0.2)",
    border: "1px solid #B8BEC9",
  },
  sectionDivider: {
    paddingTop: 4,
    borderTop: "1px solid #E5E7EB",
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "#6B7280",
    margin: 0,
  },
  optionalBlock: {
    marginTop: 2,
  },
  optionalRefinementAccent: {
    padding: "12px 12px 12px 14px",
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    backgroundColor: "#ECEEF2",
  },
  mspPromotedSection: {
    backgroundColor: "#E8EAEF",
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  partnerFlowDivider: {
    borderTop: "1px solid #D1D5DB",
    marginTop: 4,
    paddingTop: 16,
  },
  weakGatePartnerEscalation: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  weakGateTertiaryLink: {
    alignSelf: "stretch",
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    padding: "12px 16px",
    marginTop: 4,
    borderRadius: 10,
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
    fontFamily: "inherit",
    textAlign: "center" as const,
  },
  mspTrigger: {
    display: "block",
    width: "100%",
    padding: "14px 24px",
    borderRadius: 12,
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center" as const,
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },
  mspCloseButton: {
    border: "none",
    background: "transparent",
    color: "#6B7280",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    padding: "4px 8px",
  },
  escalationFormShell: {
    border: "1px solid #C4C9D4",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#ECEEF2",
  },
  escalationFormHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },

  topNav: {
    display: "flex",
    justifyContent: "flex-end",
  },
  backLink: {
    color: "#2563EB",
    textDecoration: "none",
  },

  partnerHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #E5E7EB",
  },
  partnerLogo: {
    maxHeight: 40,
    maxWidth: 140,
    objectFit: "contain",
  },
  partnerBrandingPrimary: {
    margin: 0,
    lineHeight: 1.35,
    textAlign: "center" as const,
  },
  partnerPoweredBy: {
    margin: 0,
    lineHeight: 1.4,
    textAlign: "center" as const,
  },

  riskBlock: {
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
  },

  meterContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  meterTrack: {
    width: "100%",
    height: 14,
    backgroundColor: "#9CA3AF",
    borderRadius: 7,
    border: "1px solid #6B7280",
    position: "relative",
    overflow: "visible",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
  },
  meterFillWrapper: {
    height: "100%",
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  meterFill: {
    height: "100%",
    borderRadius: 7,
    width: "100%",
  },
  meterMarker: {
    position: "absolute",
    right: -5,
    top: "50%",
    transform: "translateY(-50%)",
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: "2px solid #FFFFFF",
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
  },
  riskLevelLine: {
    textAlign: "center",
  },
  summary: {
    lineHeight: 1.5,
    margin: 0,
  },
  systemConfidenceLine: {
    margin: "6px 0 0",
    lineHeight: 1.4,
  },
  systemConfidenceHelper: {
    margin: "4px 0 0",
    lineHeight: 1.45,
  },
  narrativeGuidance: {
    lineHeight: 1.5,
    margin: 0,
  },
  refinementLimitedNote: {
    margin: "0 0 -4px",
    lineHeight: 1.4,
  },

  reasonsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  reasons: {
    margin: 0,
  },

  actionBlock: {
    backgroundColor: "#E8EAEF",
    borderRadius: 10,
    padding: "12px 14px",
    border: "1px solid #C4C9D4",
    display: "flex",
    flexDirection: "column",
  },
  actionList: {
    margin: 0,
    paddingLeft: 0,
    lineHeight: 1.5,
    listStyle: "disc",
  },

  escalationFormBlock: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #D1D5DB",
  },
  escalationFormTitle: {
    margin: 0,
  },
  escalationError: {
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
    padding: "10px 12px",
    borderRadius: 8,
    margin: 0,
  },
  escalationSuccessBlock: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  escalationSuccessText: {
    margin: 0,
    color: "#047857",
    fontWeight: 500,
  },
  escalationFormFields: {
    display: "flex",
    flexDirection: "column",
  },
  escalationLabel: {
    margin: 0,
  },
  required: {
    color: "#DC2626",
  },
  escalationInput: {
    padding: "10px 12px",
    border: "1px solid #D1D5DB",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
  },
  escalationHelper: {
    display: "block",
    lineHeight: 1.4,
    margin: "-2px 0 0 0",
  },
  escalationTextarea: {
    padding: "10px 12px",
    border: "1px solid #D1D5DB",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
    minHeight: 88,
    resize: "vertical" as const,
  },
  escalationSubmissionInfo: {
    lineHeight: 1.45,
    margin: 0,
  },
  escalationFormActions: {
    display: "flex",
    marginTop: 4,
  },
  escalationSubmitButton: {
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    backgroundColor: "#2563EB",
    border: "1px solid #1d4ed8",
    borderRadius: 8,
    color: "#FFFFFF",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
    transition: "filter 120ms ease, transform 120ms ease",
  },

  scanAnotherButton: {
    display: "block",
    padding: "14px 24px",
    borderRadius: 12,
    border: "none",
    background: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    width: "100%",
    textAlign: "center" as const,
    textDecoration: "none",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },

  footerAdvisory: {
    textAlign: "center" as const,
    margin: "2px 0 0",
    lineHeight: 1.4,
  },

  weakInputGateBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    alignItems: "stretch",
    padding: "12px 0 8px",
    margin: 0,
    border: "none",
    borderRadius: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  weakGateHeading: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
    lineHeight: 1.25,
    textAlign: "center" as const,
  },
  weakGateBody: {
    margin: 0,
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  weakGateBodySecondary: {
    margin: 0,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  weakGateArtifact: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ECEEF2",
    border: "1px solid #D1D5DB",
  },
  weakGateRefinementWrap: {
    marginTop: 28,
  },
  weakGateSecondaryLink: {
    alignSelf: "center",
    border: "none",
    backgroundColor: "transparent",
    color: "#6B7280",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    padding: "6px 8px 4px",
    marginTop: 18,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    fontFamily: "inherit",
  },

  preliminaryBadgeWrap: {
    display: "flex",
    justifyContent: "center",
  },
  preliminaryBadge: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "#B45309",
    backgroundColor: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 6,
    padding: "6px 10px",
  },
  preliminaryHeadline: {
    margin: "4px 0 0",
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    lineHeight: 1.25,
    textAlign: "center" as const,
  },
  preliminarySubtext: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  preliminarySupporting: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 1.45,
    textAlign: "center" as const,
  },
  preliminaryArtifactBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    border: "1px solid #E5E7EB",
  },
  preliminaryArtifactTitle: {
    margin: "0 0 6px",
    fontSize: 12,
    fontWeight: 600,
    color: "#6B7280",
  },
};
