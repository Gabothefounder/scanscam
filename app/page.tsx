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
    other: "What else can ScanScam help with?",
    atlasTitle: "Explore what people are seeing",
    atlasBody: "See real scam and manipulation patterns gathering in the Atlas.",
    atlasCta: "Explore the Atlas",
    happenedTitle: "Something happened to me or someone I know",
    happenedBody: "Make sense of what happened and leave with clear next steps.",
    happenedCta: "Walk through it",
    familyTitle: "Protect a family member",
    familyBody: "Help someone you care about check suspicious situations before they act.",
    familyCta: "Protect someone",
    learnTitle: "Learn how manipulation works",
    learnBody: "Understand urgency, authority, false trust, and the defenses that interrupt them.",
    learnCta: "Learn Cognitive Defense",
    howItWorks: "How it works",
    privacyLink: "Privacy & Data Use",
  },
  fr: {
    title: "Quelque chose vous semble louche?",
    subtext: "Collez un message ou un lien suspect, ou téléversez une capture d’écran. Obtenez d’abord une réponse claire.",
    reassurance: "Gratuit · Aucun compte requis · Prochaines étapes claires",
    policy:
      "Les messages peuvent être conservés de façon sécurisée jusqu’à 30 jours afin d’améliorer la détection. Aucun profil personnel n’est créé.",
    other: "Comment ScanScam peut-il aussi vous aider?",
    atlasTitle: "Voyez ce que les gens rencontrent",
    atlasBody: "Explorez les motifs réels d’arnaque et de manipulation qui se regroupent dans l’Atlas.",
    atlasCta: "Explorer l’Atlas",
    happenedTitle: "Quelque chose m’est arrivé ou est arrivé à un proche",
    happenedBody: "Comprenez ce qui s’est passé et repartez avec des prochaines étapes claires.",
    happenedCta: "Parcourir l’expérience",
    familyTitle: "Protéger un proche",
    familyBody: "Aidez une personne qui compte pour vous à vérifier une situation suspecte avant d’agir.",
    familyCta: "Protéger quelqu’un",
    learnTitle: "Comprendre comment la manipulation fonctionne",
    learnBody: "Découvrez l’urgence, l’autorité, la fausse confiance et les défenses qui les interrompent.",
    learnCta: "Apprendre la défense cognitive",
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

      <section style={styles.intentSection} aria-labelledby="home-intents">
        <div style={styles.intentHeader}>
          <p style={styles.intentEyebrow}>Beyond the scan</p>
          <h2 id="home-intents" style={styles.intentTitle}>{t.other}</h2>
        </div>

        <div style={styles.intentGrid}>
          <Link
            href={`/atlas?source=home_intent&lang=${lang}`}
            style={styles.intentCard}
            onClick={() => trackIntent("explore_atlas", "/atlas")}
          >
            <span style={styles.intentNumber}>01</span>
            <strong style={styles.cardTitle}>{t.atlasTitle}</strong>
            <span style={styles.cardBody}>{t.atlasBody}</span>
            <b style={styles.cardCta}>{t.atlasCta} →</b>
          </Link>

          <Link
            href={`/atlas?journey=1&source=home_intent&lang=${lang}`}
            style={styles.intentCard}
            onClick={() => trackIntent("something_happened", "/atlas?journey=1")}
          >
            <span style={styles.intentNumber}>02</span>
            <strong style={styles.cardTitle}>{t.happenedTitle}</strong>
            <span style={styles.cardBody}>{t.happenedBody}</span>
            <b style={styles.cardCta}>{t.happenedCta} →</b>
          </Link>

          <Link
            href={lang === "fr" ? "/fr/protect-family?source=home_intent" : "/protect-family?source=home_intent"}
            style={styles.intentCard}
            onClick={() => trackIntent("protect_family", "/protect-family")}
          >
            <span style={styles.intentNumber}>03</span>
            <strong style={styles.cardTitle}>{t.familyTitle}</strong>
            <span style={styles.cardBody}>{t.familyBody}</span>
            <b style={styles.cardCta}>{t.familyCta} →</b>
          </Link>

          <Link
            href={`/atlas?intent=learn&source=home_intent&lang=${lang}`}
            style={styles.intentCard}
            onClick={() => trackIntent("learn", "/atlas?intent=learn")}
          >
            <span style={styles.intentNumber}>04</span>
            <strong style={styles.cardTitle}>{t.learnTitle}</strong>
            <span style={styles.cardBody}>{t.learnBody}</span>
            <b style={styles.cardCta}>{t.learnCta} →</b>
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
  intentSection: {
    padding: "70px 20px 92px",
    background: "#F7F5F1",
  },
  intentHeader: {
    maxWidth: 1100,
    margin: "0 auto 24px",
  },
  intentEyebrow: {
    margin: "0 0 8px",
    color: "#9A6958",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
  },
  intentTitle: {
    maxWidth: 720,
    margin: 0,
    color: "#192128",
    fontFamily: "Georgia, serif",
    fontSize: "clamp(30px, 4vw, 46px)",
    lineHeight: 1.08,
    fontWeight: 400,
    letterSpacing: "-0.035em",
  },
  intentGrid: {
    maxWidth: 1100,
    margin: "28px auto 0",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 12,
  },
  intentCard: {
    minHeight: 235,
    padding: "22px 20px",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #D9D5CD",
    borderRadius: 16,
    background: "#FFFDFC",
    color: "#182027",
    textDecoration: "none",
    boxShadow: "0 8px 24px rgba(30,32,36,0.045)",
  },
  intentNumber: {
    color: "#B78773",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
  },
  cardTitle: {
    marginTop: 30,
    fontFamily: "Georgia, serif",
    fontSize: 22,
    lineHeight: 1.12,
    fontWeight: 400,
  },
  cardBody: {
    marginTop: 10,
    color: "#667078",
    fontSize: 14,
    lineHeight: 1.52,
  },
  cardCta: {
    marginTop: "auto",
    paddingTop: 24,
    color: "#985F49",
    fontSize: 13,
    fontWeight: 750,
  },
};
