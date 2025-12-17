"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

const copy = {
  en: {
    tier: "Medium Risk",
    summary: "This message shows common scam warning signs,",
    reasons: [
      "Creates urgency and pressure to act quickly,",
      "Requests an unusual or unexpected action,",
    ],
    guidanceTitle: "Before acting",
    guidance: [
      "Pause and don’t respond right away,",
      "Verify through another trusted channel,",
    ],
    consentTitle: "Help us improve scam detection (optional)",
    consentText:
      "Allow us to keep this anonymous signal to help protect more people.",
    allow: "Allow",
    deny: "No thanks",
    thankYou:
      "Thank you. This anonymous signal helps identify emerging scam patterns.",
    again: "Scan another message",
    close: "Close",
  },
  fr: {
    tier: "Risque moyen",
    summary: "Ce message présente des signes courants de fraude,",
    reasons: [
      "Crée un sentiment d’urgence et de pression,",
      "Demande une action inhabituelle ou inattendue,",
    ],
    guidanceTitle: "Avant d’agir",
    guidance: [
      "Prenez une pause et ne répondez pas immédiatement,",
      "Vérifiez par un autre moyen de confiance,",
    ],
    consentTitle: "Aidez à améliorer la détection (facultatif)",
    consentText:
      "Autorisez-nous à conserver ce signal anonyme pour protéger davantage de personnes.",
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

  const [consented, setConsented] = useState<null | boolean>(null);

  return (
    <main style={styles.container}>
      <section style={styles.card}>
        {/* Risk Tier */}
        <div style={styles.tierMedium}>{t.tier}</div>
        <p style={styles.summary}>{t.summary}</p>

        {/* Reasons */}
        <ul style={styles.reasons}>
          {t.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>

        {/* Guidance */}
        <div style={styles.guidance}>
          <div style={styles.guidanceTitle}>{t.guidanceTitle}</div>
          <ul>
            {t.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>

        {/* Consent */}
        <div style={styles.consent}>
          {consented === null && (
            <>
              <div style={styles.consentTitle}>{t.consentTitle}</div>
              <p style={styles.consentText}>{t.consentText}</p>
              <div style={styles.consentActions}>
                <button
                  style={styles.allow}
                  onClick={() => setConsented(true)}
                >
                  {t.allow}
                </button>
                <button
                  style={styles.deny}
                  onClick={() => setConsented(false)}
                >
                  {t.deny}
                </button>
              </div>
            </>
          )}

          {consented === true && (
            <p style={styles.thankYou}>{t.thankYou}</p>
          )}
        </div>

        {/* End Actions */}
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

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#F7F8FA",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0B1220",
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
    flexDirection: "column" as const,
    gap: "18px",
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },

  tierMedium: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#B45309", // amber
  },

  summary: {
    fontSize: "15px",
    color: "#5F6670",
  },

  reasons: {
    paddingLeft: "18px",
    fontSize: "15px",
  },

  guidance: {
    backgroundColor: "#F7F8FA",
    borderRadius: "12px",
    padding: "16px",
    fontSize: "14px",
  },

  guidanceTitle: {
    fontWeight: 600,
    marginBottom: "6px",
  },

  consent: {
    borderTop: "1px solid #E5E7EB",
    paddingTop: "16px",
    fontSize: "14px",
  },

  consentTitle: {
    fontWeight: 600,
    marginBottom: "4px",
  },

  consentText: {
    color: "#5F6670",
    marginBottom: "12px",
  },

  consentActions: {
    display: "flex",
    gap: "12px",
  },

  allow: {
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },

  deny: {
    background: "none",
    border: "1px solid #D1D5DB",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
  },

  thankYou: {
    fontSize: "14px",
    color: "#5F6670",
  },

  endActions: {
    marginTop: "8px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
  },

  link: {
    color: "#2E6BFF",
    textDecoration: "none",
    fontWeight: 500,
  },

  linkSecondary: {
    color: "#8A8F98",
    textDecoration: "none",
  },
};
