"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    headline: "Most scams are never reported.",
    body: [
      "When we stay silent, scams spread.",
      "Someone else will face this tomorrow.",
      "Reporting helps others recognize the same tactic in time.",
    ],
    microcopy: "Takes about 3 minutes. Anonymous. No accusations. No enforcement.",
    primaryCta: "Start the report",
    secondaryCta: "Not ready? Go back",
  },
  fr: {
    headline: "La majorité des arnaques ne sont jamais signalées.",
    body: [
      "Quand on reste silencieux, les arnaques se propagent.",
      "Quelqu'un d'autre y fera face demain.",
      "Signaler aide les autres à reconnaître la même tactique à temps.",
    ],
    microcopy: "Environ 3 minutes. Anonyme. Aucune accusation. Aucune intervention.",
    primaryCta: "Commencer le signalement",
    secondaryCta: "Pas prêt ? Revenir",
  },
};

/* ---------------- Page ---------------- */

export default function ReportPage() {
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
          <h1 style={styles.headline}>{t.headline}</h1>

          <div style={styles.body}>
            {t.body.map((line, i) => (
              <p key={i} style={styles.bodyLine}>
                {line}
              </p>
            ))}
          </div>

          <p style={styles.microcopy}>{t.microcopy}</p>

          <a href={`/report/who?lang=${lang}`} style={styles.primaryButton}>
            {t.primaryCta}
          </a>

          <a href={`/?lang=${lang}`} style={styles.secondaryButton}>
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

  headline: {
    fontSize: "30px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: "-0.3px",
  },

  body: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },

  bodyLine: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
  },

  microcopy: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#8A8F98",
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

