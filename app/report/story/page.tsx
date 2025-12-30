"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    question1: "What made this convincing or concerning to you?",
    helperText1: "Details matter — tone, pressure, or personal information can help others stay safe.",
    example1: "Example: \"They knew my cat's name.\"",
    question2: "In the moment, what would have helped you most?",
    helperPrompts2: [
      "A clearer warning",
      "A way to double-check",
      "Reassurance",
      "Someone to confirm my doubt",
    ],
    continue: "Continue",
    skip: "Skip this step",
  },
  fr: {
    question1: "Qu'est-ce qui a rendu cette situation crédible ou inquiétante pour vous ?",
    helperText1: "Les détails comptent — le ton, la pression ou des informations personnelles peuvent aider à protéger les autres.",
    example1: "Exemple : « Ils connaissaient le nom de mon chat. »",
    question2: "Dans le moment, qu'est-ce qui vous aurait le plus aidé ?",
    helperPrompts2: [
      "Un avertissement plus clair",
      "Un moyen de vérifier",
      "Être rassuré(e)",
      "Quelqu'un pour confirmer mon doute",
    ],
    continue: "Continuer",
    skip: "Passer cette étape",
  },
};

/* ---------------- Page ---------------- */

export default function StoryPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");

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
    sessionStorage.setItem("report_gap_text", text2.trim() || "null");
    window.location.href = `/report/region?lang=${lang}`;
  };

  const handleSkip = () => {
    sessionStorage.setItem("report_gap_text", "null");
    window.location.href = `/report/region?lang=${lang}`;
  };

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.question}>{t.question1}</h2>

          <textarea
            value={text1}
            onChange={(e) => setText1(e.target.value)}
            placeholder=""
            style={styles.textarea}
            rows={4}
          />

          <p style={styles.helperText}>{t.helperText1}</p>
          <p style={styles.example}>{t.example1}</p>

          <h2 style={styles.question}>{t.question2}</h2>

          <textarea
            value={text2}
            onChange={(e) => setText2(e.target.value)}
            placeholder=""
            style={styles.textarea}
            rows={4}
          />

          <div style={styles.helperPrompts}>
            {t.helperPrompts2.map((prompt, index) => (
              <span key={index} style={styles.promptItem}>
                {prompt}
              </span>
            ))}
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

  question: {
    fontSize: "24px",
    lineHeight: 1.3,
    fontWeight: 600,
    letterSpacing: "-0.2px",
    marginTop: "8px",
  },

  textarea: {
    minHeight: "90px",
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
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#374151",
  },

  example: {
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#4B5563",
    fontStyle: "italic" as const,
  },

  helperPrompts: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    fontSize: "15px",
    color: "#4B5563",
    fontStyle: "italic" as const,
  },

  promptItem: {
    display: "block",
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

