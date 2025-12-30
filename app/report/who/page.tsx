"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    question1: "What best describes what happened?",
    question1Options: [
      "Someone asked for money or payment",
      "Someone asked for personal information",
      "Someone pretended to be a trusted organization",
      "Something else / not sure",
    ],
    question2: "How did this reach you?",
    question2Options: [
      "Text message (SMS)",
      "Email",
      "Phone call",
      "Social media",
      "Messaging app (WhatsApp, Telegram, etc.)",
      "Website or ad",
    ],
    continue: "Continue",
    exit: "Go back",
  },
  fr: {
    question1: "Qu'est-ce qui décrit le mieux ce qui s'est passé ?",
    question1Options: [
      "Quelqu'un a demandé de l'argent ou un paiement",
      "Quelqu'un a demandé des informations personnelles",
      "Quelqu'un se faisait passer pour une organisation de confiance",
      "Autre chose / Je ne suis pas certain",
    ],
    question2: "Comment cela vous est-il parvenu ?",
    question2Options: [
      "Message texte (SMS)",
      "Courriel",
      "Appel téléphonique",
      "Réseaux sociaux",
      "Application de messagerie (WhatsApp, Telegram, etc.)",
      "Site web ou publicité",
    ],
    continue: "Continuer",
    exit: "Revenir",
  },
};

/* ---------------- Page ---------------- */

export default function WhoPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [currentQuestion, setCurrentQuestion] = useState<1 | 2>(1);
  const [selectedQ1, setSelectedQ1] = useState<string | null>(null);
  const [selectedQ2, setSelectedQ2] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    sessionStorage.setItem("report_language", currentLang);
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const t = copy[lang];

  const handleContinue = () => {
    if (currentQuestion === 1 && selectedQ1) {
      setCurrentQuestion(2);
    } else if (currentQuestion === 2 && selectedQ2) {
      window.location.href = `/report/details?lang=${lang}`;
    }
  };

  const handleOptionSelect = (option: string) => {
    if (currentQuestion === 1) {
      setSelectedQ1(option);
    } else {
      setSelectedQ2(option);
    }
  };

  const isContinueEnabled =
    (currentQuestion === 1 && selectedQ1 !== null) ||
    (currentQuestion === 2 && selectedQ2 !== null);

  const currentOptions =
    currentQuestion === 1 ? t.question1Options : t.question2Options;
  const currentQuestionText =
    currentQuestion === 1 ? t.question1 : t.question2;
  const selectedValue =
    currentQuestion === 1 ? selectedQ1 : selectedQ2;

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.question}>{currentQuestionText}</h1>

          <div style={styles.options}>
            {currentOptions.map((option, index) => {
              const isSelected = option === selectedValue;
              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
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

          <a href={`/?lang=${lang}`} style={styles.exitButton}>
            {t.exit}
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

  exitButton: {
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

