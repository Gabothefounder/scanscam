"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    instruction: "Screenshot this. This is your story — share it with people you care about.",
  },
  fr: {
    instruction: "Prenez une capture d'écran. C'est votre histoire — partagez-la avec les personnes qui comptent pour vous.",
  },
};

/* ---------------- Page ---------------- */

export default function SharePage() {
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
  const imageSrc = lang === "fr" 
    ? "/share/scanscamherosharefr.png"
    : "/share/scanscamheroshareen.png";

  return (
    <main style={styles.container}>
      <section style={styles.main}>
        <p style={styles.instruction}>{t.instruction}</p>

        <div style={styles.imageContainer}>
          <Image
            src={imageSrc}
            alt="ScanScam Hero Share"
            width={480}
            height={480}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain" as const,
            }}
            priority
          />
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
    fontFamily: "Inter, system-ui, sans-serif",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 32px",
    gap: "32px",
  },

  instruction: {
    fontSize: "18px",
    lineHeight: 1.5,
    color: "#6B7280",
    textAlign: "center" as const,
    fontWeight: 400,
    maxWidth: "500px",
  },

  imageContainer: {
    width: "min(480px, 85vw)",
    aspectRatio: "1 / 1",
    position: "relative" as const,
  },
};
