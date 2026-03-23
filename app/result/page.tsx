"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import { trackConversion } from "@/lib/gtag";

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
    confidenceLabel: "Confidence:",
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
      low: "This message does not show strong scam-related manipulation patterns.",
      medium:
        "This message shows suspicious patterns commonly used in scams. Caution is advised.",
      high:
        "This message strongly resembles known scam techniques and may be attempting to manipulate you.",
    },
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
    footerAdvisory:
      "ScanScam provides a pattern-based risk assessment. When in doubt, verify through the official source.",
    whySuspicious: "Why it looks suspicious",
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
        pay_money: "Asks for payment",
        click_link: "Asks to click a link",
        submit_credentials: "Asks for credentials or verification",
        call_number: "Asks to call a number",
        reply_sms: "Asks to reply",
        download_app: "Asks to download an app",
      } as Record<string, string>,
      threat: {
        credential_capture: "Credential capture attempt",
        payment_extraction: "Payment or fee request",
        post_loss_recovery: "Post-loss recovery scam",
        initial_lure: "Initial contact or lure",
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
      delivery_scam:
        "Parcel and delivery scams often ask for fees or personal details.",
      employment_scam:
        "Job scams may request personal information or payments upfront. Confirm job offers through the company's official channels.",
      government_impersonation:
        "Government agencies do not threaten by email or SMS.",
      account_verification:
        "Legitimate services do not suspend accounts without prior notice. Scammers use urgency and links in the message to capture credentials.",
      recovery_scam:
        "Recovery scams target people who have already lost money, promising to get it back for a fee.",
      financial_phishing:
        "Avoid clicking links in the message. Log in only through the official website or app you know.",
      prize_scam:
        "Real prizes do not require upfront fees. Be cautious of unexpected winnings or offers.",
      reward_claim:
        "Real prizes do not require upfront fees. Be cautious of unexpected winnings or offers.",
      tech_support:
        "Legitimate tech support does not cold-call or pop up uninvited. Ignore unsolicited calls or alerts.",
      romance_scam:
        "Be cautious of requests for money or personal details from people you have not met in person.",
      investment_fraud:
        "Verify investment opportunities through official sources. Be wary of guaranteed returns or pressure to act quickly.",
      law_enforcement:
        "Law enforcement does not demand payment or personal details by text or email. Verify through official channels.",
      social_engineering_opener:
        "This may be an early-stage social-engineering opener. The sender may be trying to start a conversation and build trust before a later request.",
      unknown:
        "Pause before responding. Verify through a trusted contact or official source when something feels off.",
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
    confidenceLabel: "Confiance :",
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
      low: "Ce message ne présente pas de signes clairs de manipulation frauduleuse.",
      medium:
        "Ce message présente des schémas suspects souvent associés à des fraudes. La prudence est recommandée.",
      high:
        "Ce message ressemble fortement à des techniques de fraude connues et pourrait chercher à vous manipuler.",
    },
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
    footerAdvisory:
      "ScanScam fournit une évaluation du risque basée sur des modèles de fraude connus. En cas de doute, vérifiez auprès de la source officielle.",
    whySuspicious: "Pourquoi cela paraît suspect",
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
        pay_money: "Demande un paiement",
        click_link: "Demande de cliquer sur un lien",
        submit_credentials: "Demande des identifiants ou une vérification",
        call_number: "Demande d'appeler un numéro",
        reply_sms: "Demande de répondre",
        download_app: "Demande de télécharger une application",
      } as Record<string, string>,
      threat: {
        credential_capture: "Tentative de capture d'identifiants",
        payment_extraction: "Demande de paiement ou de frais",
        post_loss_recovery: "Arnaque de récupération après perte",
        initial_lure: "Contact ou accroche initiale",
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
      delivery_scam:
        "Les arnaques aux colis demandent souvent des frais ou des renseignements personnels.",
      employment_scam:
        "Les arnaques à l'emploi peuvent demander des renseignements personnels ou des paiements. Confirmez les offres via les canaux officiels de l'entreprise.",
      government_impersonation:
        "Les organismes gouvernementaux ne menacent pas par courriel ou SMS.",
      account_verification:
        "Les services légitimes ne suspendent pas les comptes sans avertissement. Les arnaqueurs utilisent l'urgence et les liens du message pour capturer des identifiants.",
      recovery_scam:
        "Les arnaques de récupération ciblent les personnes ayant déjà perdu de l'argent, promettant de le récupérer contre des frais.",
      financial_phishing:
        "Évitez de cliquer sur les liens. Connectez-vous uniquement via le site ou l'app officiels que vous connaissez.",
      prize_scam:
        "Les vrais prix ne demandent pas de frais à l'avance. Méfiez-vous des gains ou offres inattendus.",
      reward_claim:
        "Les vrais prix ne demandent pas de frais à l'avance. Méfiez-vous des gains ou offres inattendus.",
      tech_support:
        "Le support technique légitime ne vous appelle pas sans raison. Ignorez les appels ou fenêtres non sollicités.",
      romance_scam:
        "Méfiez-vous des demandes d'argent ou de renseignements personnels de personnes que vous n'avez jamais rencontrées.",
      investment_fraud:
        "Vérifiez les opportunités d'investissement auprès de sources officielles. Méfiez-vous des rendements garantis ou de la pression.",
      law_enforcement:
        "Les forces de l'ordre ne demandent pas de paiement ou de renseignements personnels par texto ou courriel. Vérifiez via les canaux officiels.",
      social_engineering_opener:
        "Il peut s'agir d'une accroche d'ingénierie sociale en début de conversation. L'expéditeur peut chercher à entamer un échange et à gagner votre confiance avant une demande ultérieure.",
      unknown:
        "Prenez une pause avant de répondre. Vérifiez auprès d'un contact fiable ou d'une source officielle si quelque chose vous semble étrange.",
    },
  },
};

/* ---------- Risk Meter ---------- */

const RISK_CONFIG = {
  low: { percent: 30, color: "#16A34A", bgColor: "#E8F5EC" },
  medium: { percent: 60, color: "#D97706", bgColor: "#FDF6E8" },
  high: { percent: 90, color: "#DC2626", bgColor: "#FBEAEA" },
};

function RiskMeter({ risk, label, levelText }: { risk: "low" | "medium" | "high"; label: string; levelText: string }) {
  const config = RISK_CONFIG[risk];

  return (
    <div style={styles.meterContainer} role="meter" aria-valuenow={config.percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
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
      <div style={styles.riskLevelLine}>{levelText}</div>
    </div>
  );
}

export default function ResultPage() {
  const [result, setResult] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const conversionFiredForScanRef = useRef<string | null>(null);

  /* ---------- load scan result ---------- */

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const l = params.get("lang");
      setLang(l === "fr" ? "fr" : "en");

      const stored = sessionStorage.getItem("scanResult");
      if (stored) {
        const parsed = JSON.parse(stored);
        setResult(parsed);

        const riskTier = parsed.risk ?? parsed.risk_tier ?? "low";
        const scanId = parsed.scan_id;
        const key = scanId ? `scan_shown:${scanId}` : null;
        if (scanId && key && !firedOnce.has(key)) {
          firedOnce.add(key);
          let attrProps: Record<string, string> = {};
          try {
            const stored = sessionStorage.getItem("scan_attribution");
            if (stored) attrProps = JSON.parse(stored);
          } catch {
            /* ignore */
          }
          logScanEvent("scan_shown", {
            scan_id: scanId,
            props: { risk_tier: riskTier, ...attrProps },
          });
        }
        if (scanId && conversionFiredForScanRef.current !== scanId) {
          conversionFiredForScanRef.current = scanId;
          trackConversion("AW-16787240010/-lHQCNrulP0bEMro48Q-");
        }
      }
    } catch {
      setResult(null);
    }
  }, []);

  if (!result) return null;

  const t = copy[lang];

  const risk: "low" | "medium" | "high" =
    result.risk ?? result.risk_tier ?? "low";

  const intel = result.intel_features ?? {};

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

    if (route === "insufficient_context" || ctx === "fragment") {
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

  const summary =
    result.summary_sentence || t.defaultSummary[risk];

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
  };

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        {/* ---------- Top Nav ---------- */}
        <div style={styles.topNav}>
          <a href={`/?lang=${lang}`} style={styles.backLink}>
            {t.backHome}
          </a>
        </div>

        {/* ---------- A) Risk Block ---------- */}
        <div style={riskBlockStyle}>
          <div style={styles[`tier_${risk}`]}>{t.tier[risk]}</div>
          <RiskMeter risk={risk} label={t.tier[risk]} levelText={`${t.riskLevelLabel} ${t.riskLevel[risk]}`} />
          <p style={styles.summary}>{summary}</p>
          <p style={styles.confidence}>
            {t.confidenceLabel} {confidenceText}
          </p>
          <p style={styles.confidenceHelper}>{confidenceHelperText}</p>
        </div>

        {/* ---------- Why it looks suspicious (grounded in intel_features) ---------- */}
        {(groundedReasons.length > 0 || narrativeGuidanceText) && (
          <div style={styles.reasonsBlock}>
            <div style={styles.whySuspicious}>{t.whySuspicious}</div>
            {groundedReasons.length > 0 && (
              <ul style={styles.reasons}>
                {groundedReasons.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
            {narrativeGuidanceText && (
              <p style={styles.narrativeGuidance}>{narrativeGuidanceText}</p>
            )}
          </div>
        )}

        {/* ---------- B) Action Block (max 3 bullets) ---------- */}
        <div style={styles.actionBlock}>
          <div style={styles.actionTitle}>{t.actionTitle}</div>
          <ul style={styles.actionList}>
            {nextSteps.map((g, i) => (
              <li key={i} style={styles.actionItem}>
                <strong>{g.action}</strong>
                <span style={styles.actionExplanation}>{g.explanation}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- C) Scan Another CTA ---------- */}
        <a href={`/scan?lang=${lang}`} style={styles.scanAnotherButton}>
          {t.scanAnother}
        </a>

        {/* ---------- Footer (single advisory) ---------- */}
        <p style={styles.footerAdvisory}>{t.footerAdvisory}</p>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "calc(100vh - 156px)",
    backgroundColor: "#E2E4E9",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "24px 16px 16px",
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "16px 20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
  },

  topNav: {
    display: "flex",
    justifyContent: "flex-end",
  },
  backLink: {
    color: "#2563EB",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
  },

  riskBlock: {
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  tier_low: { fontSize: 22, fontWeight: 700, color: "#15803D", textAlign: "center" },
  tier_medium: { fontSize: 22, fontWeight: 700, color: "#B45309", textAlign: "center" },
  tier_high: { fontSize: 22, fontWeight: 700, color: "#B91C1C", textAlign: "center" },

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
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  summary: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 1.5,
    margin: 0,
  },
  confidence: {
    fontSize: 13,
    color: "#6B7280",
    margin: "4px 0 0",
    lineHeight: 1.4,
  },
  confidenceHelper: {
    fontSize: 12,
    color: "#9CA3AF",
    margin: "2px 0 0",
    lineHeight: 1.4,
  },
  narrativeGuidance: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 1.5,
    margin: "8px 0 0",
  },

  reasonsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  whySuspicious: {
    fontSize: 18,
    fontWeight: 600,
    color: "#6B7280",
    margin: 0,
  },
  reasons: {
    paddingLeft: 18,
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 1.5,
    margin: 0,
  },

  actionBlock: {
    backgroundColor: "#D9DCDF",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  actionTitle: {
    fontWeight: 700,
    fontSize: 18,
    color: "#111827",
  },
  actionList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 1.5,
    listStyle: "disc",
  },
  actionItem: {
    marginBottom: 12,
  },
  actionExplanation: {
    display: "block",
    marginTop: 4,
    fontSize: 15,
    fontWeight: 400,
  },
  scanAnotherButton: {
    display: "block",
    padding: "14px 24px",
    fontSize: 17,
    fontWeight: 700,
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
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center" as const,
    margin: "2px 0 0",
    lineHeight: 1.4,
  },
};
