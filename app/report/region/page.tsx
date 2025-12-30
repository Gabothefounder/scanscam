"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    headline: "Help protect your community (optional)",
    body: "Sharing a city helps us detect local scam waves and warn others sooner.",
    inputLabel: "City (optional)",
    continue: "Continue",
    skip: "Skip this step",
  },
  fr: {
    headline: "Aidez-nous à protéger votre communauté (facultatif)",
    body: "Indiquer une ville nous aide à détecter les vagues locales d'arnaque et à prévenir plus rapidement.",
    inputLabel: "Ville (facultatif)",
    continue: "Continuer",
    skip: "Passer cette étape",
  },
};

/* ---------------- Page ---------------- */

export default function RegionPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [city, setCity] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const t = copy[lang];

  const handleContinue = () => {
    sessionStorage.setItem("report_city", city.trim() || "null");
    window.location.href = `/report/confirm?lang=${lang}`;
  };

  const handleSkip = () => {
    sessionStorage.setItem("report_city", "null");
    window.location.href = `/report/confirm?lang=${lang}`;
  };

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.headline}>{t.headline}</h1>

          <p style={styles.body}>{t.body}</p>

          <div style={styles.inputGroup}>
            <label style={styles.label}>{t.inputLabel}</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder=""
              style={styles.input}
            />
          </div>

          <button onClick={handleContinue} style={styles.continueButton}>
            {t.continue}
          </button>

          <button onClick={handleSkip} style={styles.skipButton}>
            {t.skip}
          </button>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Styles ---------------- */

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#F7F8FA",
    color: "#0B1220",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
  },

  card: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "#FFFFFF",
    borderRadius: "16px",
    padding: "36px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    boxShadow: "0 12px 36px rgba(11,18,32,0.08)",
  },

  headline: {
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: "-0.3px",
  },

  body: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },

  label: {
    fontSize: "16px",
    fontWeight: 500,
    color: "#0B1220",
  },

  input: {
    padding: "14px",
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#0B1220",
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  continueButton: {
    marginTop: "10px",
    padding: "16px 18px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: "16px",
    cursor: "pointer",
  },

  skipButton: {
    marginTop: "8px",
    padding: "16px 18px",
    backgroundColor: "transparent",
    color: "#5F6670",
    textAlign: "center" as const,
    borderRadius: "12px",
    border: "none",
    fontWeight: 500,
    fontSize: "16px",
    cursor: "pointer",
  },
};

