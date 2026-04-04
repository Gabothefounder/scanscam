"use client";

import { useEffect, useState } from "react";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    title: "Is this a scam?",
    subtext: "Paste a suspicious message or upload a screenshot to check instantly.",
    primaryCta: "Check Now",
    reassurance: "No login required. Instant results. No personal profile.",
    policy1: "Messages may be stored securely for up to 30 days to improve detection.",
    policy2: "Approximate region (city-level) may be used to detect local scam trends.",
    policy3: "No accounts. No personal tracking or profiling.",
    howItWorks: "How it works",
    privacyLink: "Privacy & Data Use",
  },
  fr: {
    title: "Est-ce une arnaque ?",
    subtext: "Collez un message suspect ou téléversez une capture d'écran pour vérifier instantanément.",
    primaryCta: "Vérifier maintenant",
    reassurance: "Aucune connexion requise. Résultats instantanés. Aucun profil personnel.",
    policy1: "Les messages peuvent être stockés de manière sécurisée jusqu'à 30 jours pour améliorer la détection.",
    policy2: "La région approximative (niveau ville) peut être utilisée pour détecter les tendances locales.",
    policy3: "Aucun compte. Aucun suivi personnel ni profilage.",
    howItWorks: "Comment ça marche",
    privacyLink: "Confidentialité et utilisation des données",
  },
};

/* ---------------- Page ---------------- */

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  const [scanHref, setScanHref] = useState("/scan");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);

    const attr = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
    const scanParams = new URLSearchParams({ lang: currentLang });
    attr.forEach((k) => {
      const v = params.get(k);
      if (v) scanParams.set(k, v);
    });
    setScanHref(`/scan?${scanParams.toString()}`);
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

          <a href={scanHref} style={styles.primaryButton}>
            {t.primaryCta}
          </a>
          <p style={styles.reassurance}>{t.reassurance}</p>

          <div style={styles.policyBlock}>
            <p style={styles.policyText}>{t.policy1}</p>
            <p style={styles.policyText}>{t.policy2}</p>
            <p style={styles.policyText}>{t.policy3}</p>
            <p style={styles.policyLinks}>
              <a href={`/how-it-works?lang=${lang}`} style={styles.policyLink}>
                {t.howItWorks}
              </a>
              {" · "}
              <a href={`/privacy?lang=${lang}`} style={styles.policyLink}>
                {t.privacyLink}
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Styles ---------------- */

const styles = {
  container: {
    height: "calc(100vh - 156px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E4E9",
    color: "#0B1220",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  main: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "16px",
    paddingRight: "16px",
    width: "100%",
  },

  card: {
    width: "100%",
    maxWidth: "600px",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
  },

  title: {
    fontSize: "36px",
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: "-0.4px",
    textAlign: "center" as const,
  },

  subtext: {
    fontSize: "18px",
    lineHeight: 1.5,
    color: "#374151",
    textAlign: "center" as const,
  },

  primaryButton: {
    marginTop: "4px",
    padding: "14px 24px",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "17px",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
  },

  reassurance: {
    marginTop: "4px",
    marginBottom: 0,
    fontSize: "16px",
    fontWeight: 500,
    color: "#374151",
    textAlign: "center" as const,
  },

  policyBlock: {
    marginTop: "12px",
    paddingTop: "10px",
    borderTop: "1px solid rgba(0,0,0,0.06)",
  },

  policyText: {
    margin: "0 0 4px",
    fontSize: "12px",
    color: "#9CA3AF",
    textAlign: "center" as const,
    lineHeight: 1.4,
  },

  policyLinks: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#9CA3AF",
    textAlign: "center" as const,
  },

  policyLink: {
    color: "#2563EB",
    textDecoration: "none",
  },
};
