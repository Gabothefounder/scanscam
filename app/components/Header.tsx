"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

function isConversationPath(pathname: string | null): boolean {
  return pathname === "/conversation" || pathname === "/fr/conversation";
}

export default function Header() {
  const pathname = usePathname();
  const hideLangToggle = pathname === "/parking-ticket-text";
  const conversationMode = isConversationPath(pathname);

  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  /* --- ensure stable first render (hydration-safe) --- */
  useEffect(() => {
    if (conversationMode) {
      setLang(pathname === "/fr/conversation" ? "fr" : "en");
    } else {
      const params = new URLSearchParams(window.location.search);
      const currentLang = params.get("lang") === "fr" ? "fr" : "en";
      setLang(currentLang);
    }
    setMounted(true);
  }, [conversationMode, pathname]);

  if (!mounted) {
    return null;
  }

  const switchLang = () => {
    // Conversation smoke pages use path-based locales only; leave all other routes unchanged.
    if (conversationMode) {
      const params = window.location.search || "";
      const nextPath = lang === "fr" ? "/conversation" : "/fr/conversation";
      window.location.assign(`${nextPath}${params}`);
      return;
    }

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

      {!hideLangToggle ? (
        <button type="button" onClick={switchLang} style={styles.langSwitch}>
          {lang === "fr" ? "EN" : "FR"}
        </button>
      ) : null}
    </header>
  );
}

const styles: any = {
  header: {
    width: "100%",
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
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
