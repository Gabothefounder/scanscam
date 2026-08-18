"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { captureAttribution, getAttribution } from "@/lib/attribution";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";
import {
  FAMILY_PROTECT_COPY,
  type FamilyProtectLang,
  type WhoProtectOption,
} from "@/lib/family-protect/copy";

const ATTR_PROP_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

function attributionTelemetryProps(): Record<string, string> {
  const attr = getAttribution();
  const props: Record<string, string> = {};
  for (const k of ATTR_PROP_KEYS) {
    const v = attr[k]?.trim();
    if (v) props[k] = v;
  }
  return props;
}

function attributionPersistFields(): Record<string, string> {
  const attr = getAttribution();
  const out: Record<string, string> = {};
  for (const k of ATTR_PROP_KEYS) {
    const v = attr[k]?.trim();
    if (v) out[k] = v;
  }
  if (attr.referrer?.trim()) out.referrer = attr.referrer.trim();
  if (attr.landing_path?.trim()) out.landing_path = attr.landing_path.trim();
  return out;
}

type Props = {
  lang: FamilyProtectLang;
};

export default function FamilyProtectLanding({ lang }: Props) {
  const t = FAMILY_PROTECT_COPY[lang];
  const formRef = useRef<HTMLElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const [whoProtect, setWhoProtect] = useState<WhoProtectOption["value"] | "">(
    ""
  );
  const [concernText, setConcernText] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    captureAttribution();
    logScanEvent("family_protect_page_view", {
      props: { lang, flow: "family_protect", ...attributionTelemetryProps() },
    });
  }, [lang]);

  const scrollToForm = () => {
    logScanEvent("family_protect_cta_click", {
      props: { lang, flow: "family_protect", ...attributionTelemetryProps() },
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => firstFieldRef.current?.focus(), 350);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || submitted) return;
    setError(null);

    if (!whoProtect) {
      setError(t.errorMessage);
      return;
    }
    if (!firstName.trim()) {
      setError(t.errorMessage);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/family-protect/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          email,
          who_protect: whoProtect,
          concern_text: concernText,
          lang,
          contact_consent: true,
          ...attributionPersistFields(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!res.ok || !data?.ok) {
        setError(t.errorMessage);
        return;
      }

      setSubmitted(true);
      logScanEvent("family_protect_signup", {
        props: {
          lang,
          flow: "family_protect",
          who_protect_category: whoProtect,
          ...attributionTelemetryProps(),
        },
      });
    } catch {
      setError(t.errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.column}>
        <header style={styles.hero}>
          <h1 style={styles.headline}>{t.headline}</h1>
          {t.heroBody.map((p, i) => (
            <p key={`hero-${i}`} style={styles.body}>
              {p}
            </p>
          ))}
          <button type="button" style={styles.primaryCta} onClick={scrollToForm}>
            {t.primaryCta}
          </button>
        </header>

        <section style={styles.section} aria-labelledby="founder-heading">
          <h2 id="founder-heading" style={styles.sectionHeading}>
            {t.founderHeading}
          </h2>
          {t.founderBody.map((p, i) => (
            <p key={`founder-${i}`} style={styles.body}>
              {p}
            </p>
          ))}
        </section>

        <section style={styles.section}>
          <p style={styles.body}>{t.whyNowBody}</p>
        </section>

        <section style={styles.section} aria-labelledby="thesis-heading">
          <h2 id="thesis-heading" style={styles.sectionHeading}>
            {t.thesisHeading}
          </h2>
          {t.thesisBody.map((p, i) => (
            <p key={`thesis-${i}`} style={styles.body}>
              {p}
            </p>
          ))}
        </section>

        <section
          id="early-access"
          ref={formRef}
          style={styles.earlyAccess}
          aria-labelledby="early-access-heading"
        >
          <h2 id="early-access-heading" style={styles.researchHeading}>
            {t.earlyAccessHeading}
          </h2>
          {t.earlyAccessBody.map((p, i) => (
            <p key={`ea-${i}`} style={styles.body}>
              {p}
            </p>
          ))}
          <p style={styles.note}>{t.earlyAccessNote}</p>

          {submitted ? (
            <p style={styles.success} role="status">
              {t.successMessage}
            </p>
          ) : (
            <form style={styles.form} onSubmit={onSubmit} noValidate>
              <fieldset style={styles.fieldset}>
                <legend style={styles.label}>{t.whoLabel}</legend>
                <div style={styles.options}>
                  {t.whoOptions.map((opt, idx) => (
                    <label key={opt.value} style={styles.option}>
                      <input
                        ref={idx === 0 ? firstFieldRef : undefined}
                        type="radio"
                        name="who_protect"
                        value={opt.value}
                        checked={whoProtect === opt.value}
                        onChange={() => setWhoProtect(opt.value)}
                        required
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label style={styles.field}>
                <span style={styles.label}>{t.concernLabel}</span>
                <textarea
                  value={concernText}
                  onChange={(e) => setConcernText(e.target.value)}
                  placeholder={t.concernPlaceholder}
                  rows={4}
                  maxLength={2000}
                  style={styles.textarea}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>{t.firstNameLabel}</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t.firstNamePlaceholder}
                  required
                  autoComplete="given-name"
                  maxLength={80}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>{t.emailLabel}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  required
                  autoComplete="email"
                  maxLength={254}
                  style={styles.input}
                />
              </label>

              <p style={styles.consent}>{t.consentText}</p>

              <button
                type="submit"
                style={styles.primaryCta}
                disabled={submitting}
              >
                {submitting ? t.submittingLabel : t.submitCta}
              </button>

              {error ? (
                <p style={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </section>
      </div>
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
    paddingBottom: "56px",
  },
  column: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto",
    padding: "0 20px",
    boxSizing: "border-box",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    paddingTop: "40px",
    paddingBottom: "28px",
  },
  headline: {
    margin: 0,
    fontSize: "clamp(32px, 5vw, 46px)",
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: "-0.5px",
    color: "#0B1220",
  },
  body: {
    margin: 0,
    fontSize: "clamp(16.5px, 1.2vw, 17px)",
    lineHeight: 1.65,
    color: "#374151",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingTop: "28px",
    paddingBottom: "8px",
  },
  sectionHeading: {
    margin: 0,
    fontSize: "clamp(22px, 3.5vw, 28px)",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: "-0.3px",
    color: "#0B1220",
  },
  earlyAccess: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "36px",
    padding: "28px 22px",
    backgroundColor: "#EFF4FF",
    border: "1px solid #D9E4FF",
    borderLeft: "3px solid #2563EB",
    borderRadius: "16px",
  },
  researchHeading: {
    margin: 0,
    fontSize: "clamp(24px, 4vw, 30px)",
    lineHeight: 1.22,
    fontWeight: 700,
    letterSpacing: "-0.35px",
    color: "#0B1220",
  },
  note: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#6B7280",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    marginTop: "4px",
  },
  fieldset: {
    margin: 0,
    padding: 0,
    border: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  options: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "16px",
    lineHeight: 1.45,
    color: "#0B1220",
    cursor: "pointer",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#0B1220",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: "16px",
    lineHeight: 1.4,
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#0B1220",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: "16px",
    lineHeight: 1.5,
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#0B1220",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  consent: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#6B7280",
  },
  primaryCta: {
    display: "block",
    width: "100%",
    marginTop: "4px",
    padding: "16px 22px",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    textAlign: "center",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "17px",
    lineHeight: 1.3,
    border: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  success: {
    margin: "8px 0 0",
    fontSize: "16px",
    lineHeight: 1.55,
    fontWeight: 600,
    color: "#0B1220",
  },
  error: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#B91C1C",
  },
};
