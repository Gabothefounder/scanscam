"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    title: "Spot scams early. Protect yourself and others.",
    subtext: "Quickly analyze suspicious messages — or report them to help make the world a little safer for everyone.",
    primaryCta: "Scan a Scam",
    primarySubtext: "Instant, anonymous analysis.",
    secondaryCta: "Report a Scam",
    secondarySubtext: "Take 3 minutes. Turn what happened to you into a warning for others.",
    footer: "This tool highlights warning signs only.",
  },
  fr: {
    title: "Repérez les arnaques plus tôt. Protégez-vous et les autres.",
    subtext: "Analysez rapidement les messages suspects ou signalez-les pour éviter qu'ils se répètent.",
    primaryCta: "Analyser une arnaque",
    primarySubtext: "Analyse instantanée et anonyme.",
    secondaryCta: "Signaler une arnaque",
    secondarySubtext: "Prenez 3 minutes. Transformez ce que vous avez vécu en avertissement pour les autres.",
    footer: "Cet outil met en évidence des signes d'alerte seulement.",
  },
};

/* ---------------- Page ---------------- */

export default function Home() {
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

  return (
    <main style={styles.container}>
      {/* Main */}
      <section style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtext}>{t.subtext}</p>

          <a href={`/scan?lang=${lang}`} style={styles.primaryButton}>
            {t.primaryCta}
          </a>
          <p style={styles.buttonSubtext}>{t.primarySubtext}</p>

          <a href={`/report?lang=${lang}`} style={styles.primaryButton}>
            {t.secondaryCta}
          </a>
          <p style={styles.buttonSubtext}>{t.secondarySubtext}</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>{t.footer}</footer>
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

  title: {
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: "-0.3px",
  },

  subtext: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
  },

  primaryButton: {
    marginTop: "10px",
    padding: "16px 18px",
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "16px",
  },

  buttonSubtext: {
    marginTop: "8px",
    fontSize: "14px",
    color: "#8A8F98",
  },

  footer: {
    padding: "18px",
    fontSize: "13px",
    color: "#8A8F98",
    textAlign: "center" as const,
  },
};
