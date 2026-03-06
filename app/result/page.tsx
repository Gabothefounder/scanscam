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
    backHome: "Back to home",
    scanAnother: "Scan another message",
    footerAdvisory:
      "ScanScam provides a pattern-based risk assessment. When in doubt, verify through the official source.",
    whySuspicious: "Why it looks suspicious",
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
        "Parcel and delivery scams often ask for fees or personal details. Verify tracking through the official carrier website or app.",
      employment_scam:
        "Job scams may request personal information or payments upfront. Confirm job offers through the company's official channels.",
      government_impersonation:
        "Government agencies do not threaten by email or SMS. Never share your SIN, passwords, or banking details with unsolicited contacts.",
      financial_phishing:
        "Avoid clicking links in the message. Log in only through the official website or app you know.",
      prize_scam:
        "Real prizes do not require upfront fees. Be cautious of unexpected winnings or offers.",
      tech_support:
        "Legitimate tech support does not cold-call or pop up uninvited. Ignore unsolicited calls or alerts.",
      romance_scam:
        "Be cautious of requests for money or personal details from people you have not met in person.",
      investment_fraud:
        "Verify investment opportunities through official sources. Be wary of guaranteed returns or pressure to act quickly.",
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
    backHome: "Retour à l'accueil",
    scanAnother: "Analyser un autre message",
    footerAdvisory:
      "ScanScam fournit une évaluation du risque basée sur des modèles de fraude connus. En cas de doute, vérifiez auprès de la source officielle.",
    whySuspicious: "Pourquoi cela paraît suspect",
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
        "Les arnaques aux colis demandent souvent des frais ou des renseignements personnels. Vérifiez le suivi sur le site ou l'app officielle du transporteur.",
      employment_scam:
        "Les arnaques à l'emploi peuvent demander des renseignements personnels ou des paiements. Confirmez les offres via les canaux officiels de l'entreprise.",
      government_impersonation:
        "Les organismes gouvernementaux ne menacent pas par courriel ou SMS. Ne partagez jamais votre NAS, mots de passe ou informations bancaires.",
      financial_phishing:
        "Évitez de cliquer sur les liens. Connectez-vous uniquement via le site ou l'app officiels que vous connaissez.",
      prize_scam:
        "Les vrais prix ne demandent pas de frais à l'avance. Méfiez-vous des gains ou offres inattendus.",
      tech_support:
        "Le support technique légitime ne vous appelle pas sans raison. Ignorez les appels ou fenêtres non sollicités.",
      romance_scam:
        "Méfiez-vous des demandes d'argent ou de renseignements personnels de personnes que vous n'avez jamais rencontrées.",
      investment_fraud:
        "Vérifiez les opportunités d'investissement auprès de sources officielles. Méfiez-vous des rendements garantis ou de la pression.",
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
          logScanEvent("scan_shown", {
            scan_id: scanId,
            props: { risk_tier: riskTier },
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

  const signalCues: string[] = (() => {
    const signals = Array.isArray(result.signals) ? result.signals : [];
    if (signals.length === 0) return [];
    const labels = copy[lang].signalLabels;
    const seen = new Set<string>();
    return signals
      .map((s: { type?: string }) => {
        const typeKey = (s.type ?? "").trim().toLowerCase().replace(/\s+/g, "_");
        if (!typeKey) return null;
        const label = labels[typeKey] ?? typeKey.replace(/_/g, " ");
        if (seen.has(label)) return null;
        seen.add(label);
        return label.charAt(0).toUpperCase() + label.slice(1);
      })
      .filter((r: string | null): r is string => !!r);
  })();

  const summary =
    result.summary_sentence || t.defaultSummary[risk];

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
        </div>

        {/* ---------- Why it looks suspicious (signals only) ---------- */}
        {signalCues.length > 0 && (
          <div style={styles.reasonsBlock}>
            <div style={styles.whySuspicious}>{t.whySuspicious}</div>
            <ul style={styles.reasons}>
              {signalCues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------- B) Action Block (max 3 bullets) ---------- */}
        <div style={styles.actionBlock}>
          <div style={styles.actionTitle}>{t.actionTitle}</div>
          <ul style={styles.actionList}>
            {t.guidance.map((g, i) => (
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
