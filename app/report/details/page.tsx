"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    headline: "Tell us what happened.",
    body: [
      "In your own words, describe the situation.",
      "Include anything that felt unusual, urgent, or personal.",
    ],
    helperText: "Details matter — tone, pressure, or personal information can help others stay safe.",
    example: "Example: \"They knew my cat's name.\"",
    continue: "Continue",
    goBack: "Go back",
  },
  fr: {
    headline: "Racontez-nous ce qui s'est passé.",
    body: [
      "Avec vos propres mots, décrivez la situation.",
      "Incluez tout ce qui vous a semblé inhabituel, urgent ou personnel.",
    ],
    helperText: "Les détails comptent — le ton, la pression ou des informations personnelles peuvent aider à protéger les autres.",
    example: "Exemple : « Ils connaissaient le nom de mon chat. »",
    continue: "Continuer",
    goBack: "Revenir",
  },
};

/* ---------------- Page ---------------- */

export default function DetailsPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [text, setText] = useState("");

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
    if (text.trim()) {
      window.location.href = `/report/ask?lang=${lang}`;
    }
  };

  const isContinueEnabled = text.trim().length > 0;

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.headline}>{t.headline}</h1>

          <div style={styles.body}>
            {t.body.map((line, i) => (
              <p key={i} style={styles.bodyLine}>
                {line}
              </p>
            ))}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder=""
            style={styles.textarea}
            rows={8}
          />

          <p style={styles.helperText}>{t.helperText}</p>
          <p style={styles.example}>{t.example}</p>

          <button
            onClick={handleContinue}
            disabled={!isContinueEnabled}
            style={{
              ...styles.continueButton,
              ...(isContinueEnabled
                ? styles.continueButtonEnabled
                : styles.continueButtonDisabled),
            }}
          >
            {t.continue}
          </button>

          <a href={`/report/who?lang=${lang}`} style={styles.goBackButton}>
            {t.goBack}
          </a>
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
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },

  bodyLine: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
  },

  textarea: {
    minHeight: "160px",
    padding: "14px",
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#0B1220",
    backgroundColor: "#FFFFFF",
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  helperText: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#5F6670",
  },

  example: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#8A8F98",
    fontStyle: "italic" as const,
  },

  continueButton: {
    marginTop: "10px",
    padding: "16px 18px",
    borderRadius: "12px",
    border: "none",
    fontWeight: 600,
    fontSize: "16px",
    cursor: "pointer",
  },

  continueButtonEnabled: {
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
  },

  continueButtonDisabled: {
    backgroundColor: "#E5E7EB",
    color: "#9CA3AF",
    cursor: "not-allowed",
  },

  goBackButton: {
    marginTop: "8px",
    padding: "16px 18px",
    backgroundColor: "transparent",
    color: "#5F6670",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "16px",
  },
};

