"use client";

import { useEffect } from "react";
import { captureAttribution, getAttribution } from "@/lib/attribution";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import {
  CONVERSATION_COPY,
  type ConversationLang,
} from "@/lib/conversation/copy";

const ATTR_PROP_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

/** Reuse existing landing attribution for telemetry (allowlisted UTM/gclid only — no PII). */
function attributionTelemetryProps(): Record<string, string> {
  const attr = getAttribution();
  const props: Record<string, string> = {};
  for (const k of ATTR_PROP_KEYS) {
    const v = attr[k]?.trim();
    if (v) props[k] = v;
  }
  return props;
}

type Props = {
  lang: ConversationLang;
};

export default function ConversationLanding({ lang }: Props) {
  const t = CONVERSATION_COPY[lang];

  useEffect(() => {
    captureAttribution();
    logScanEvent("conversation_page_view", {
      props: { lang, flow: "conversation", ...attributionTelemetryProps() },
    });
  }, [lang]);

  const onBookingClick = () => {
    logScanEvent("conversation_booking_click", {
      props: { lang, flow: "conversation", ...attributionTelemetryProps() },
    });
  };

  const onEmailClick = () => {
    logScanEvent("conversation_email_click", {
      props: { lang, flow: "conversation", ...attributionTelemetryProps() },
    });
  };

  return (
    <main style={styles.page}>
      <div style={styles.column}>
        {/* Hero — founder video can be inserted between hero and research ask later */}
        <header style={styles.hero}>
          <p style={styles.eyebrow}>{t.eyebrow}</p>
          <h1 style={styles.headline}>{t.headline}</h1>
          <p style={styles.body}>{t.heroLead}</p>
          <p style={styles.trustQuestion}>{t.trustQuestion}</p>
          {t.heroAfter.map((p, i) => (
            <p key={`hero-${i}`} style={styles.body}>
              {p}
            </p>
          ))}
        </header>

        {/* Research ask — one soft highlight, CTA inside */}
        <section style={styles.researchPanel} aria-labelledby="research-ask">
          <h2 id="research-ask" style={styles.researchHeading}>
            {t.researchAskHeading}
          </h2>
          {t.researchAskBody.map((p, i) => (
            <p key={`ask-${i}`} style={styles.researchBody}>
              {p}
            </p>
          ))}
          <a
            href={t.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.primaryCta}
            onClick={onBookingClick}
          >
            {t.primaryCta}
          </a>
          <p style={styles.ctaSupport}>{t.ctaSupport}</p>
          <p style={styles.emailMuted}>
            <span>{t.secondaryLabel}</span>{" "}
            <a
              href={t.emailHref}
              style={styles.emailLink}
              onClick={onEmailClick}
            >
              {t.secondaryEmail}
            </a>
          </p>
        </section>
      </div>

      {/* Vision — pale full-width surface */}
      <section style={styles.visionBand} aria-labelledby="vision-heading">
        <div style={styles.column}>
          <hr style={styles.divider} />
          <h2 id="vision-heading" style={styles.visionHeading}>
            {t.visionHeading}
          </h2>
          <p style={styles.body}>{t.visionBody[0]}</p>
          <p style={styles.body}>{t.visionBody[1]}</p>
        </div>
      </section>

      {/* Closing — email only (no second booking CTA) */}
      <section style={styles.finalBand} aria-labelledby="final-heading">
        <div style={styles.column}>
          <h2 id="final-heading" style={styles.finalHeading}>
            {t.finalHeading}
          </h2>
          <p style={styles.body}>{t.finalBody}</p>
          <p style={{ margin: 0 }}>
            <a
              href={t.emailHref}
              style={styles.finalEmailLink}
              onClick={onEmailClick}
            >
              {t.finalSecondary}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    backgroundColor: "#FFFFFF",
    color: "#0B1220",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    boxSizing: "border-box",
  },
  column: {
    width: "100%",
    maxWidth: "760px",
    margin: "0 auto",
    padding: "0 20px",
    boxSizing: "border-box",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    paddingTop: "40px",
    paddingBottom: "40px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.4,
    letterSpacing: "0.07em",
    fontWeight: 600,
    color: "#6B7280",
    textTransform: "uppercase" as const,
  },
  headline: {
    margin: 0,
    fontSize: "clamp(32px, 5vw, 48px)",
    lineHeight: 1.12,
    fontWeight: 700,
    letterSpacing: "-0.55px",
    color: "#0B1220",
  },
  trustQuestion: {
    margin: "10px 0 6px",
    fontSize: "clamp(22px, 3.5vw, 30px)",
    lineHeight: 1.3,
    fontWeight: 700,
    letterSpacing: "-0.3px",
    color: "#0B1220",
  },
  body: {
    margin: 0,
    fontSize: "clamp(16.5px, 1.2vw, 17px)",
    lineHeight: 1.65,
    color: "#374151",
  },
  researchPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "8px",
    padding: "28px 22px",
    backgroundColor: "#EFF4FF",
    border: "1px solid #D9E4FF",
    borderLeft: "3px solid #2563EB",
    borderRadius: "16px",
    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.04)",
  },
  researchHeading: {
    margin: 0,
    fontSize: "clamp(24px, 4vw, 32px)",
    lineHeight: 1.22,
    fontWeight: 700,
    letterSpacing: "-0.35px",
    color: "#0B1220",
  },
  researchBody: {
    margin: 0,
    fontSize: "clamp(16.5px, 1.2vw, 17px)",
    lineHeight: 1.65,
    color: "#374151",
  },
  primaryCta: {
    display: "block",
    width: "100%",
    marginTop: "6px",
    padding: "17px 22px",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    textAlign: "center",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "17px",
    lineHeight: 1.3,
    boxSizing: "border-box",
  },
  ctaSupport: {
    margin: "2px 0 0",
    fontSize: "15px",
    lineHeight: 1.55,
    color: "#6B7280",
  },
  emailMuted: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#6B7280",
  },
  emailLink: {
    color: "#2563EB",
    fontWeight: 600,
    textDecoration: "none",
  },
  finalEmailLink: {
    color: "#2563EB",
    fontWeight: 600,
    fontSize: "clamp(16.5px, 1.2vw, 17px)",
    lineHeight: 1.55,
    textDecoration: "none",
  },
  visionBand: {
    width: "100%",
    marginTop: "48px",
    paddingTop: "48px",
    paddingBottom: "48px",
    backgroundColor: "#F4F6F9",
    boxSizing: "border-box",
  },
  divider: {
    margin: "0 0 28px",
    border: "none",
    borderTop: "1px solid #E5E7EB",
    width: "100%",
  },
  visionHeading: {
    margin: "0 0 18px",
    fontSize: "clamp(24px, 4vw, 34px)",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.4px",
    color: "#0B1220",
  },
  finalBand: {
    width: "100%",
    paddingTop: "56px",
    paddingBottom: "48px",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
  },
  finalHeading: {
    margin: "0 0 14px",
    fontSize: "clamp(24px, 4vw, 32px)",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.35px",
    color: "#0B1220",
  },
};
