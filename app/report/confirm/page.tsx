"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { ReportPayload } from "@/lib/report/reportPayload";

/* ---------------- Copy ---------------- */

const copy = {
  en: {
    headline: "Review and confirm",
    body: [
      "You're about to submit an anonymous report.",
      "This information helps identify scam patterns and warn others.",
    ],
    consentText: "I understand this report is anonymous and will be used to help prevent scams.",
    submit: "Submit report",
    goBack: "Go back",
    exit: "Exit without submitting",
  },
  fr: {
    headline: "Vérifier et confirmer",
    body: [
      "Vous êtes sur le point de soumettre un signalement anonyme.",
      "Ces informations aident à identifier des schémas d'arnaque et à protéger les autres.",
    ],
    consentText: "Je comprends que ce signalement est anonyme et servira à prévenir les arnaques.",
    submit: "Soumettre le signalement",
    goBack: "Revenir",
    exit: "Quitter sans soumettre",
  },
};

/* ---------------- Helper Functions ---------------- */

function mapAskType(uiValue: string | null): ReportPayload["ask_type"] | null {
  if (!uiValue) return null;
  const mapping: Record<string, ReportPayload["ask_type"]> = {
    "Click a link": "link",
    "Cliquer sur un lien": "link",
    "Share a code or password": "code",
    "Partager un code ou un mot de passe": "code",
    "Send money": "money",
    "Envoyer de l'argent": "money",
    "Share personal information": "personal_info",
    "Fournir des informations personnelles": "personal_info",
    "Download something": "download",
    "Télécharger quelque chose": "download",
    "Something else": "other",
    "Autre chose": "other",
  };
  return mapping[uiValue] || null;
}

function mapEngagementOutcome(
  uiValue: string | null
): ReportPayload["engagement_outcome"] | null {
  if (!uiValue) return null;
  const mapping: Record<string, ReportPayload["engagement_outcome"]> = {
    "I recognized it and stopped": "stopped",
    "J'ai reconnu le risque et j'ai arrêté": "stopped",
    "I clicked or replied": "clicked",
    "J'ai cliqué ou répondu": "clicked",
    "I lost money": "lost_money",
    "J'ai perdu de l'argent": "lost_money",
    "I'm not sure": "unsure",
    "Je ne suis pas certain(e)": "unsure",
  };
  return mapping[uiValue] || null;
}

function mapIdentityImpact(
  uiValue: string | null
): ReportPayload["identity_impact"] {
  if (!uiValue) return null;
  const mapping: Record<string, ReportPayload["identity_impact"]> = {
    "No": "none",
    "Non": "none",
    "Yes — personal information exposed": "personal_info_exposed",
    "Oui — informations personnelles compromises": "personal_info_exposed",
    "Yes — account taken over": "account_taken_over",
    "Oui — compte piraté": "account_taken_over",
    "Not sure": "unsure",
    "Incertain(e)": "unsure",
  };
  return mapping[uiValue] || null;
}

function mapFinancialLossRange(
  uiValue: string | null
): ReportPayload["financial_loss_range"] {
  if (!uiValue) return null;
  const mapping: Record<string, ReportPayload["financial_loss_range"]> = {
    "No loss": "none",
    "Aucune perte": "none",
    "Less than $500": "lt_500",
    "Moins de 500 $": "lt_500",
    "$500 to $5,000": "500_5000",
    "Entre 500 $ et 5 000 $": "500_5000",
    "More than $5,000": "gt_5000",
    "Plus de 5 000 $": "gt_5000",
    "Prefer not to say": "prefer_not_to_say",
    "Préfère ne pas répondre": "prefer_not_to_say",
  };
  return mapping[uiValue] || null;
}

function buildPayload(): ReportPayload | null {
  try {
    // Read required fields from sessionStorage
    const languageStr = sessionStorage.getItem("report_language");
    const askTypeStr = sessionStorage.getItem("report_ask_type");
    const engagementOutcomeStr = sessionStorage.getItem("report_engagement_outcome");
    const consentGivenStr = sessionStorage.getItem("report_consent_given");

    // Read optional fields from sessionStorage
    const identityImpactStr = sessionStorage.getItem("report_identity_impact");
    const financialLossStr = sessionStorage.getItem("report_financial_loss");
    const cityStr = sessionStorage.getItem("report_city");
    const storyTextStr = sessionStorage.getItem("report_story_text");
    const gapTextStr = sessionStorage.getItem("report_gap_text");

    // Validate required fields are present
    if (!languageStr || !askTypeStr || !engagementOutcomeStr || !consentGivenStr) {
      return null;
    }

    // Validate language
    if (languageStr !== "en" && languageStr !== "fr") {
      return null;
    }

    // Map required enum fields
    const ask_type = mapAskType(askTypeStr);
    const engagement_outcome = mapEngagementOutcome(engagementOutcomeStr);

    if (!ask_type || !engagement_outcome) {
      return null;
    }

    // Validate consent_given is "true"
    if (consentGivenStr !== "true") {
      return null;
    }

    // Handle optional fields (convert "null" string to null)
    const identity_impact = identityImpactStr && identityImpactStr !== "null" 
      ? mapIdentityImpact(identityImpactStr) 
      : null;

    const financial_loss_range = financialLossStr && financialLossStr !== "null"
      ? mapFinancialLossRange(financialLossStr)
      : null;

    const city = cityStr && cityStr !== "null" 
      ? cityStr.trim() || null 
      : null;

    const story_text = storyTextStr && storyTextStr !== "null"
      ? storyTextStr.trim() || null
      : null;

    const gap_text = gapTextStr && gapTextStr !== "null"
      ? gapTextStr.trim() || null
      : null;

    return {
      language: languageStr as "en" | "fr",
      ask_type,
      engagement_outcome,
      consent_given: true,
      identity_impact,
      financial_loss_range,
      city,
      story_text,
      gap_text,
    };
  } catch {
    return null;
  }
}

/* ---------------- Page ---------------- */

export default function ConfirmPage() {
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!consentChecked || isSubmitting) return;

    sessionStorage.setItem("report_consent_given", "true");
    setIsSubmitting(true);
    setError(null);

    const payload = buildPayload();

    if (!payload) {
      setError("Unable to build report payload");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/report/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.ok === true) {
        window.location.href = `/report/success?lang=${lang}`;
      } else {
        setError(result.error || "Failed to submit report");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Report submission failed:", err);
      setError("Failed to submit report");
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.container}>
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

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.consentText}>{t.consentText}</span>
          </label>

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!consentChecked || isSubmitting}
            style={{
              ...styles.submitButton,
              ...(consentChecked && !isSubmitting
                ? styles.submitButtonEnabled
                : styles.submitButtonDisabled),
            }}
          >
            {isSubmitting ? "Submitting..." : t.submit}
          </button>

          <a href={`/report/story?lang=${lang}`} style={styles.goBackButton}>
            {t.goBack}
          </a>

          <a href={`/?lang=${lang}`} style={styles.exitButton}>
            {t.exit}
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
    gap: "8px",
  },

  bodyLine: {
    fontSize: "17px",
    lineHeight: 1.55,
    color: "#5F6670",
  },

  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    cursor: "pointer",
  },

  checkbox: {
    width: "20px",
    height: "20px",
    marginTop: "2px",
    cursor: "pointer",
    flexShrink: 0,
  },

  consentText: {
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#0B1220",
  },

  submitButton: {
    marginTop: "10px",
    padding: "16px 18px",
    borderRadius: "12px",
    border: "none",
    fontWeight: 600,
    fontSize: "16px",
    cursor: "pointer",
  },

  submitButtonEnabled: {
    backgroundColor: "#2E6BFF",
    color: "#FFFFFF",
  },

  submitButtonDisabled: {
    backgroundColor: "#E5E7EB",
    color: "#9CA3AF",
    cursor: "not-allowed",
  },

  goBackButton: {
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

  exitButton: {
    marginTop: "8px",
    padding: "16px 18px",
    backgroundColor: "transparent",
    color: "#8A8F98",
    textAlign: "center" as const,
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 400,
    fontSize: "14px",
  },

  errorText: {
    fontSize: "14px",
    color: "#DC2626",
    marginTop: "4px",
  },
};

