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
      "Pause before responding — legitimate services don't require immediate action.",
      "Verify independently using a trusted contact or official website.",
    ],
    presence:
      "Whenever something feels off, ScanScam is here to help you check.",
    backHome: "Back to home",
    scanAnother: "Scan another message",
    quickToolTitle: "Make this your quick scam check tool",
    quickToolText:
      "ScanScam analyzes manipulation patterns used in phishing, impersonation, and urgency-based scams. Bookmark this page so you can verify suspicious messages anytime.",
    footerMuted: "The most effective protection is pausing before reacting.",
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
      "Prenez un moment avant de répondre — les services légitimes n'exigent pas d'action immédiate.",
      "Vérifiez de manière indépendante via un contact fiable ou un site officiel.",
    ],
    presence:
      "Si quelque chose vous semble étrange, ScanScam est là pour vous aider à vérifier.",
    backHome: "Retour à l'accueil",
    scanAnother: "Analyser un autre message",
    quickToolTitle: "Utilisez ScanScam comme outil de vérification rapide",
    quickToolText:
      "ScanScam analyse les schémas de manipulation utilisés dans le phishing, l'usurpation d'identité et les arnaques par urgence. Ajoutez cette page à vos favoris pour vérifier les messages suspects à tout moment.",
    footerMuted: "La meilleure protection est de prendre une pause avant de réagir.",
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
        const hasValidResult = scanId || parsed.risk || parsed.risk_tier;
        if (hasValidResult && conversionFiredForScanRef.current !== scanId) {
          conversionFiredForScanRef.current = scanId || "no-id";
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

  const reasons: string[] = Array.isArray(result.reasons)
    ? result.reasons
    : Array.isArray(result.signals)
    ? result.signals.map((s: any) => s.description)
    : [];

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

        {/* ---------- Reasons (if any) ---------- */}
        {reasons.length > 0 && (
          <ul style={styles.reasons}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        {/* ---------- B) Action Block ---------- */}
        <div style={styles.actionBlock}>
          <div style={styles.actionTitle}>{t.actionTitle}</div>
          <ul style={styles.actionList}>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <p style={styles.presence}>{t.presence}</p>
        </div>

        {/* ---------- C) Scan Another CTA ---------- */}
        <a href={`/scan?lang=${lang}`} style={styles.scanAnotherButton}>
          {t.scanAnother}
        </a>

        {/* ---------- D) Quick Tool Info ---------- */}
        <div style={styles.quickToolBlock}>
          <div style={styles.quickToolTitle}>{t.quickToolTitle}</div>
          <p style={styles.quickToolText}>{t.quickToolText}</p>
        </div>

        {/* ---------- E) Footer Muted ---------- */}
        <p style={styles.footerMuted}>{t.footerMuted}</p>
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
    fontSize: 15,
    color: "#1F2937",
    lineHeight: 1.5,
    margin: 0,
  },

  reasons: {
    paddingLeft: 18,
    fontSize: 14,
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
    fontSize: 15,
    color: "#111827",
  },
  actionList: {
    margin: 0,
    paddingLeft: 16,
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 1.5,
  },
  presence: {
    fontSize: 13,
    color: "#4B5563",
    margin: 0,
    marginTop: 2,
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

  quickToolBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  quickToolTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6B7280",
    margin: 0,
  },
  quickToolText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 1.55,
    margin: 0,
  },

  footerMuted: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center" as const,
    margin: "4px 0 0",
  },
};
