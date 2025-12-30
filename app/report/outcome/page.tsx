"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    question: "What happened next?",
    options: [
      "I recognized it and stopped",
      "I clicked or replied",
      "I lost money",
      "I'm not sure",
    ],
    continue: "Continue",
    goBack: "Go back",
  },
  fr: {
    question: "Qu'est-ce qui s'est passé ensuite ?",
    options: [
      "J'ai reconnu le risque et j'ai arrêté",
      "J'ai cliqué ou répondu",
      "J'ai perdu de l'argent",
      "Je ne suis pas certain(e)",
    ],
    continue: "Continuer",
    goBack: "Revenir",
  },
};

/* ---------------- Page ---------------- */

export default function OutcomePage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

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
    if (selectedOption) {
      window.location.href = `/report/impact?lang=${lang}`;
    }
  };

  const isContinueEnabled = selectedOption !== null;

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.question}>{t.question}</h1>

          <div style={styles.options}>
            {t.options.map((option, index) => {
              const isSelected = option === selectedOption;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedOption(option)}
                  style={{
                    ...styles.optionButton,
                    ...(isSelected ? styles.optionButtonSelected : {}),
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>

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

          <a href={`/report/ask?lang=${lang}`} style={styles.goBackButton}>
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

  question: {
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: "-0.3px",
  },

  options: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },

  optionButton: {
    padding: "16px 18px",
    backgroundColor: "#FFFFFF",
    color: "#0B1220",
    textAlign: "left" as const,
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    cursor: "pointer",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: 1.5,
    transition: "all 0.2s",
  },

  optionButtonSelected: {
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    borderColor: "#2E6BFF",
    fontWeight: 500,
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

