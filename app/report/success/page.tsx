"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    primaryMessage: "Thank you.",
    secondaryMessage: "You're not alone.",
    supportingLine: "Your report strengthens a shared warning that helps protect others.",
    primaryCta: "Share with people you care about",
    secondaryCta: "Scan another message",
  },
  fr: {
    primaryMessage: "Merci.",
    secondaryMessage: "Vous n'êtes pas seul(e).",
    supportingLine: "Votre signalement renforce un avertissement collectif qui aide à protéger les autres.",
    primaryCta: "Partager avec les personnes qui comptent pour vous",
    secondaryCta: "Analyser un autre message",
  },
};

/* ---------------- Page ---------------- */

export default function SuccessPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

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

  const handleShare = async () => {
    const shareData = {
      title: "ScanScam",
      text:
        lang === "fr"
          ? "Vérifiez les messages suspects pour détecter des signes d'arnaque"
          : "Check suspicious messages for scam warning signs",
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error occurred, fall through to home
        window.location.href = `/?lang=${lang}`;
      }
    } else {
      // Fallback to home if native share not available
      window.location.href = `/?lang=${lang}`;
    }
  };

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.primaryMessage}>{t.primaryMessage}</h1>

          <p style={styles.secondaryMessage}>{t.secondaryMessage}</p>

          <p style={styles.supportingLine}>{t.supportingLine}</p>

          <button onClick={handleShare} style={styles.primaryButton}>
            {t.primaryCta}
          </button>

          <a href={`/scan?lang=${lang}`} style={styles.secondaryButton}>
            {t.secondaryCta}
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

  primaryMessage: {
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: "-0.3px",
  },

  secondaryMessage: {
    fontSize: "20px",
    lineHeight: 1.4,
    fontWeight: 500,
    color: "#0B1220",
    marginTop: "8px",
  },

  supportingLine: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
    marginTop: "12px",
  },

  primaryButton: {
    marginTop: "10px",
    padding: "16px 18px",
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    textAlign: "center" as const,
    borderRadius: "12px",
    border: "none",
    fontWeight: 600,
    fontSize: "16px",
    cursor: "pointer",
  },

  secondaryButton: {
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

