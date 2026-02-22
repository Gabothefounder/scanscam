"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

/* ---------- copy ---------- */

const copy = {
  en: {
    tier: {
      low: "Low Risk",
      medium: "Medium Risk",
      high: "High Risk",
    },
    defaultSummary: {
      low: "This message does not show strong scam-related manipulation patterns.",
      medium:
        "This message shows suspicious patterns commonly used in scams. Caution is advised.",
      high:
        "This message strongly resembles known scam techniques and may be attempting to manipulate you.",
    },
    guidanceTitle: "Before acting",
    guidance: [
      "Pause before responding — legitimate services don't require immediate action.",
      "Verify independently using a trusted contact or official website.",
    ],
    presence:
      "Whenever something feels off, ScanScam is here to help you check.",
    again: "Scan another message",
    close: "Close",
  },
  fr: {
    tier: {
      low: "Risque faible",
      medium: "Risque moyen",
      high: "Risque élevé",
    },
    defaultSummary: {
      low: "Ce message ne présente pas de signes clairs de manipulation frauduleuse.",
      medium:
        "Ce message présente des schémas suspects souvent associés à des fraudes. La prudence est recommandée.",
      high:
        "Ce message ressemble fortement à des techniques de fraude connues et pourrait chercher à vous manipuler.",
    },
    guidanceTitle: "Avant d'agir",
    guidance: [
      "Prenez un moment avant de répondre — les services légitimes n'exigent pas d'action immédiate.",
      "Vérifiez de manière indépendante via un contact fiable ou un site officiel.",
    ],
    presence:
      "Si quelque chose vous semble étrange, ScanScam est là pour vous aider à vérifier.",
    again: "Analyser un autre message",
    close: "Fermer",
  },
};

export default function ResultPage() {
  const [result, setResult] = useState<any>(null);
  const [lang, setLang] = useState<"en" | "fr">("en");

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
        logScanEvent("scan_shown", { tier: riskTier });
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

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        <div style={styles[`tier_${risk}`]}>{t.tier[risk]}</div>

        <p style={styles.summary}>{summary}</p>

        {reasons.length > 0 && (
          <ul style={styles.reasons}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        <div style={styles.guidance}>
          <div style={styles.guidanceTitle}>{t.guidanceTitle}</div>
          <ul>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        <p style={styles.presence}>{t.presence}</p>

        <div style={styles.endActions}>
          <a href={`/scan?lang=${lang}`} style={styles.link}>
            {t.again}
          </a>
          <a href="/" style={styles.linkSecondary}>
            {t.close}
          </a>
        </div>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    display: "flex",
    justifyContent: "center",
    padding: "16px",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },
  tier_low: { fontSize: 22, fontWeight: 600, color: "#065F46" },
  tier_medium: { fontSize: 22, fontWeight: 600, color: "#92400E" },
  tier_high: { fontSize: 22, fontWeight: 600, color: "#7F1D1D" },
  summary: { fontSize: 15, color: "#111827" },
  reasons: { paddingLeft: 18, fontSize: 15, color: "#111827" },
  guidance: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#111827",
  },
  guidanceTitle: { fontWeight: 600, marginBottom: 6 },
  presence: { fontSize: 13, color: "#374151" },
  endActions: {
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
  },
  link: { color: "#2563EB", textDecoration: "none", fontWeight: 500 },
  linkSecondary: { color: "#374151", textDecoration: "none" },
};
