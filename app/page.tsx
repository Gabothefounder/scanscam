"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScannerForm } from "@/components/ScannerForm";
import { captureAttribution } from "@/lib/attribution";
import { useScanSuccessNavigation } from "@/lib/scan/useScanSuccessNavigation";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

const copy = {
  en: {
    title: "Something feels off?",
    subtext: "Paste a suspicious message, link, or upload a screenshot. Get the answer first.",
    reassurance: "Free · No account required · Clear next steps",
    policy:
      "Messages may be stored securely for up to 30 days to improve detection. No personal profile is created.",
    atlasCta: "Explore the Atlas",
    happenedCta: "Something happened?",
    familyCta: "Protect someone",
    howItWorks: "How it works",
    privacyLink: "Privacy & Data Use",
  },
  fr: {
    title: "Quelque chose vous semble louche?",
    subtext: "Collez un message ou un lien suspect, ou téléversez une capture d’écran. Obtenez d’abord une réponse claire.",
    reassurance: "Gratuit · Aucun compte requis · Prochaines étapes claires",
    policy:
      "Les messages peuvent être conservés de façon sécurisée jusqu’à 30 jours afin d’améliorer la détection. Aucun profil personnel n’est créé.",
    atlasCta: "Explorer l’Atlas",
    happenedCta: "Quelque chose est arrivé?",
    familyCta: "Protéger un proche",
    howItWorks: "Comment ça marche",
    privacyLink: "Confidentialité et utilisation des données",
  },
};

export default function Home() {
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    captureAttribution();
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    logScanEvent("page_view", {
      props: { surface: "home", flow: "public_home", lang: currentLang },
    });
  }, []);

  const handleScanSuccess = useScanSuccessNavigation(lang);

  const t = copy[lang];
  const trackIntent = (intent: string, target: string) => {
    logScanEvent("intent_selected", {
      props: { surface: "home", flow: "public_home", intent, target, lang },
    });
  };

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.scannerCard}>
          <p style={styles.eyebrow}>ScanScam</p>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtext}>{t.subtext}</p>

          <div style={styles.scannerShell}>
            <ScannerForm lang={lang} onScanSuccess={handleScanSuccess} surface="home" />
          </div>

          <p style={styles.reassurance}>{t.reassurance}</p>
          <p style={styles.policy}>{t.policy}</p>
          <p style={styles.policyLinks}>
            <Link href={`/how-it-works?lang=${lang}`} style={styles.policyLink}>
              {t.howItWorks}
            </Link>
            {" · "}
            <Link href={`/privacy?lang=${lang}`} style={styles.policyLink}>
              {t.privacyLink}
            </Link>
          </p>
        </div>
      </section>

      <section style={styles.quickLinksSection} aria-label={lang === "fr" ? "Autres options" : "Other options"}>
        <div style={styles.quickLinks}>
          <Link
            href={`/atlas?source=home_intent&lang=${lang}`}
            style={styles.quickLink}
            onClick={() => trackIntent("explore_atlas", "/atlas")}
          >
            {t.atlasCta}
          </Link>
          <Link
            href={`/atlas?journey=1&source=home_intent&lang=${lang}`}
            style={styles.quickLink}
            onClick={() => trackIntent("something_happened", "/atlas?journey=1")}
          >
            {t.happenedCta}
          </Link>
          <Link
            href={lang === "fr" ? "/fr/protect-family?source=home_intent" : "/protect-family?source=home_intent"}
            style={styles.quickLink}
            onClick={() => trackIntent("protect_family", "/protect-family")}
          >
            {t.familyCta}
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    background: "#E2E4E9",
    color: "#0B1220",
    fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
  },
  hero: {
    minHeight: "calc(100vh - 156px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "42px 16px 54px",
    boxSizing: "border-box",
  },
  scannerCard: {
    width: "100%",
    maxWidth: 700,
    background: "#FFFFFF",
    border: "1px solid #C7CCD5",
    borderRadius: 18,
    padding: "34px 30px 28px",
    boxShadow: "0 18px 54px rgba(11,18,32,0.16)",
    boxSizing: "border-box",
  },
  eyebrow: {
    margin: "0 0 10px",
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 6vw, 52px)",
    lineHeight: 1.05,
    fontWeight: 760,
    letterSpacing: "-0.04em",
    textAlign: "center",
  },
  subtext: {
    maxWidth: 560,
    margin: "14px auto 24px",
    color: "#4B5563",
    fontSize: 17,
    lineHeight: 1.55,
    textAlign: "center",
  },
  scannerShell: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  reassurance: {
    margin: "18px 0 0",
    color: "#374151",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
  },
  policy: {
    maxWidth: 580,
    margin: "10px auto 0",
    color: "#8A9099",
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: "center",
  },
  policyLinks: {
    margin: "7px 0 0",
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
  },
  policyLink: {
    color: "#4F6EA8",
    textDecoration: "none",
  },
  quickLinksSection: {
    padding: "0 16px 44px",
    background: "#E2E4E9",
  },
  quickLinks: {
    maxWidth: 700,
    margin: "0 auto",
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  quickLink: {
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid #C8CDD5",
    background: "rgba(255,255,255,0.58)",
    color: "#4B5563",
    fontSize: 13,
    fontWeight: 650,
    textDecoration: "none",
  },
};
