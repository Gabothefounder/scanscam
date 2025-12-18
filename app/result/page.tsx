"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/* ---------- types ---------- */

type AnalysisSignal = {
  type: string;
  evidence: string;
  weight?: number;
};

type ScanResult = {
  risk_tier: "low" | "medium" | "high";
  summary_sentence?: string;
  signals: AnalysisSignal[];
  data_quality: {
    is_message_like: boolean;
  };
  language?: "en" | "fr";
  source?: "user_text" | "ocr";
  used_fallback?: boolean;
};

/* ---------- copy ---------- */

const copy = {
  en: {
    tier: {
      low: "Low Risk",
      medium: "Medium Risk",
      high: "High Risk",
    },
    defaultSummary: "No strong scam patterns were detected in this message.",
    guidanceTitle: "Before acting",
    guidance: [
      "Pause before responding — legitimate services don’t require immediate action.",
      "Verify independently using a trusted contact or official website.",
    ],
    presence:
      "Whenever something feels off, ScanScam is here to help you check.",
    consentTitle: "Help improve scam detection (optional)",
    consentText:
      "Allow us to keep this anonymous signal to help protect others.",
    allow: "Allow",
    deny: "No thanks",
    thankYou:
      "Thank you. This anonymous signal helps identify emerging scam patterns.",
    again: "Scan another message",
    close: "Close",
  },
  fr: {
    tier: {
      low: "Risque faible",
      medium: "Risque moyen",
      high: "Risque élevé",
    },
    defaultSummary:
      "Aucun signal fort de fraude n’a été détecté dans ce message.",
    guidanceTitle: "Avant d’agir",
    guidance: [
      "Prenez un moment avant de répondre — les services légitimes n’exigent pas d’action immédiate.",
      "Vérifiez de manière indépendante via un contact fiable ou un site officiel.",
    ],
    presence:
      "Si quelque chose vous semble étrange, ScanScam est là pour vous aider à vérifier.",
    consentTitle: "Aider à améliorer la détection (facultatif)",
    consentText:
      "Autorisez la conservation de ce signal anonyme pour protéger davantage de personnes.",
    allow: "Autoriser",
    deny: "Non merci",
    thankYou:
      "Merci. Ce signal anonyme aide à détecter de nouvelles formes de fraude.",
    again: "Analyser un autre message",
    close: "Fermer",
  },
};

export default function ResultPage() {
  const params = useSearchParams();
  const lang = params.get("lang") === "fr" ? "fr" : "en";
  const t = copy[lang];

  const [result, setResult] = useState<ScanResult | null>(null);
  const [consented, setConsented] = useState<null | boolean>(null);
  const [consentSent, setConsentSent] = useState(false);

  /* ---------- load analysis result ---------- */

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("scanResult");
      if (stored) {
        setResult(JSON.parse(stored));
      }
    } catch {
      setResult(null);
    }
  }, []);

  /* ---------- consent side-effect (D1.2 + D1.3) ---------- */

  useEffect(() => {
    if (
      consented !== true ||
      !result ||
      consentSent
    )
      return;

    setConsentSent(true);

    fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: true,
        scan_result: result,
      }),
    }).catch(() => {
      // Silent by design — never affect UX
    });
  }, [consented, result, consentSent]);

  /* ---------- derived UI fields ---------- */

  const risk = result?.risk_tier ?? "low";
  const reasons =
    result?.signals?.map((s) => s.evidence) ?? [];

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        {/* Risk Tier */}
        <div style={styles[`tier_${risk}`]}>
          {t.tier[risk]}
        </div>

        {/* Summary */}
        <p style={styles.summary}>
          {result?.summary_sentence ||
            t.defaultSummary}
        </p>

        {/* Reasons */}
        {reasons.length > 0 && (
          <ul style={styles.reasons}>
            {reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}

        {/* Guidance */}
        <div style={styles.guidance}>
          <div style={styles.guidanceTitle}>
            {t.guidanceTitle}
          </div>
          <ul>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        {/* ScanScam presence */}
        <p style={styles.presence}>{t.presence}</p>

        {/* Consent (post-result only) */}
        {result && (
          <div style={styles.consent}>
            {consented === null && (
              <>
                <div style={styles.consentTitle}>
                  {t.consentTitle}
                </div>
                <p style={styles.consentText}>
                  {t.consentText}
                </p>
                <div style={styles.consentActions}>
                  <button
                    style={styles.allow}
                    onClick={() =>
                      setConsented(true)
                    }
                  >
                    {t.allow}
                  </button>
                  <button
                    style={styles.deny}
                    onClick={() =>
                      setConsented(false)
                    }
                  >
                    {t.deny}
                  </button>
                </div>
              </>
            )}

            {consented === true && (
              <p style={styles.thankYou}>
                {t.thankYou}
              </p>
            )}
          </div>
        )}

        {/* End actions */}
        <div style={styles.endActions}>
          <a
            href={`/scan?lang=${lang}`}
            style={styles.link}
          >
            {t.again}
          </a>
          <a
            href="/"
            style={styles.linkSecondary}
          >
            {t.close}
          </a>
        </div>
      </section>
    </main>
  );
}

/* ---------- styles ---------- */

const styles: any = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    fontFamily: "Inter, system-ui, sans-serif",
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
  tier_medium: { fontSize: 22, fontWeight: 600, color: "#B45309" },
  tier_high: { fontSize: 22, fontWeight: 600, color: "#991B1B" },
  summary: { fontSize: 15, color: "#5F6670" },
  reasons: { paddingLeft: 18, fontSize: 15 },
  guidance: {
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
  },
  guidanceTitle: { fontWeight: 600, marginBottom: 6 },
  presence: { fontSize: 13, color: "#6B7280" },
  consent: { borderTop: "1px solid #E5E7EB", paddingTop: 16 },
  consentTitle: { fontWeight: 600 },
  consentText: { color: "#5F6670", marginBottom: 12 },
  consentActions: { display: "flex", gap: 12 },
  allow: {
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  deny: {
    background: "none",
    border: "1px solid #D1D5DB",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
  },
  thankYou: { fontSize: 14, color: "#5F6670" },
  endActions: {
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
  },
  link: { color: "#2E6BFF", textDecoration: "none", fontWeight: 500 },
  linkSecondary: { color: "#8A8F98", textDecoration: "none" },
};

