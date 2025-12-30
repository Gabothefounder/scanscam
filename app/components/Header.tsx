"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  /* --- ensure stable first render (hydration-safe) --- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentLang = params.get("lang") === "fr" ? "fr" : "en";
    setLang(currentLang);
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const switchLang = () => {
    const params = new URLSearchParams(window.location.search);
    const nextLang = lang === "fr" ? "en" : "fr";
    params.set("lang", nextLang);
    window.location.search = params.toString();
  };

  return (
    <header style={styles.header}>
      <a href="/" style={styles.brand}>
        <Image
          src="/Logo/Lucid-mark.png"
          alt="ScanScam"
          width={44}
          height={44}
          priority
        />
        <span style={styles.brandText}>ScanScam</span>
      </a>

      <button onClick={switchLang} style={styles.langSwitch}>
        {lang === "fr" ? "EN" : "FR"}
      </button>
    </header>
  );
}

const styles: any = {
  header: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textDecoration: "none",
    cursor: "pointer",
  },

  brandText: {
    fontSize: "26px",
    fontWeight: 600,
    color: "#0B1220",
  },

  langSwitch: {
    background: "transparent",
    border: "none",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
    color: "#2E6BFF",
  },
};
