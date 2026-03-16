"use client";

import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "scanscam_cookie_consent" as const;

export type CookieConsentChoice = "accepted" | "declined" | null;

function getInitialConsent(): CookieConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function getStoredCookieConsent(): CookieConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function useCookieConsent(): [CookieConsentChoice, (choice: Exclude<CookieConsentChoice, null>) => void] {
  const [choice, setChoice] = useState<CookieConsentChoice>(null);

  useEffect(() => {
    setChoice(getInitialConsent());
  }, []);

  const update = (next: Exclude<CookieConsentChoice, null>) => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, next);
    } catch {
      // ignore storage errors
    }
    setChoice(next);
  };

  return [choice, update];
}

type Lang = "en" | "fr";

const COPY: Record<
  Lang,
  {
    heading: string;
    text: string;
    accept: string;
    decline: string;
    privacyLabel: string;
  }
> = {
  en: {
    heading: "Privacy choices",
    text:
      "ScanScam uses cookies and measurement tools to improve the service, detect fraud trends, and measure advertising performance.",
    accept: "Accept",
    decline: "Decline",
    privacyLabel: "Privacy & Data Use",
  },
  fr: {
    heading: "Choix de confidentialité",
    text:
      "ScanScam utilise des cookies et des outils de mesure pour améliorer le service, détecter les tendances de fraude et mesurer la performance publicitaire.",
    accept: "Accepter",
    decline: "Refuser",
    privacyLabel: "Confidentialité et utilisation des données",
  },
};

export default function CookieConsentBanner() {
  const [choice, setChoice] = useCookieConsent();
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const currentLang = params.get("lang") === "fr" ? "fr" : "en";
      setLang(currentLang);
    } catch {
      setLang("en");
    }
  }, []);

  if (choice) {
    return null;
  }

  const t = COPY[lang];

  const handleAccept = () => setChoice("accepted");
  const handleDecline = () => setChoice("declined");

  const privacyHref = `/privacy?lang=${lang}`;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 24,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          margin: "10px 16px",
          maxWidth: 760,
          width: "100%",
          backgroundColor: "#111827",
          color: "#F9FAFB",
          borderRadius: 12,
          padding: "14px 20px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 13,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9CA3AF",
          }}
        >
          {t.heading}
        </div>
        <div style={{ lineHeight: 1.5 }}>
          {t.text}{" "}
          <a
            href={privacyHref}
            style={{
              color: "#BFDBFE",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {t.privacyLabel}
          </a>
          .
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={handleDecline}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              borderRadius: 999,
              border: "1px solid #4B5563",
              background: "transparent",
              color: "#E5E7EB",
              cursor: "pointer",
              minWidth: 88,
            }}
          >
            {t.decline}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            style={{
              padding: "7px 16px",
              fontSize: 13,
              borderRadius: 999,
              border: "none",
              background: "#22C55E",
              color: "#022C22",
              fontWeight: 600,
              cursor: "pointer",
              minWidth: 96,
            }}
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

