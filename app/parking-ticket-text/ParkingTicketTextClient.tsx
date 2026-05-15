"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  branchMeta,
  buildPlainTextChecklist,
  checklistDisclaimer,
  checklistMissingLabel,
  checklistMissingPlaceholder,
  checklistUsefulOptions,
  checklistUsefulQuestion,
  concernNotes,
  contactEmail,
  contactQuestionsPrefix,
  getChecklistSections,
  helpfulGuidanceLabel,
  helpfulNotesTitle,
  helpfulReportingLabel,
  hero,
  needAnotherMessageLead,
  openTextWarning,
  postChecklistLine,
  privacyNote,
  q1Options,
  q2Options,
  q3Options,
  q1AnswerPhrase,
  reportingNoteBody,
  validationMessage,
} from "@/lib/parkingTicketText/copy";
import {
  CHECKLIST_VERSION,
  LANGUAGE,
  PAGE_VERSION,
  PRIVACY_NOTE_VERSION,
} from "@/lib/parkingTicketText/constants";
import {
  checklistBranchFromQ1,
  concernNoteIdFromQ2,
  optionalQ2ExtraBullet,
} from "@/lib/parkingTicketText/routing";
import type { ChecklistBranch } from "@/lib/parkingTicketText/types";

const MAX_OPEN = 500;

function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getUtm(search: string): Record<string, string> {
  const p = new URLSearchParams(search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
  const o: Record<string, string> = {};
  for (const k of keys) {
    const v = p.get(k)?.trim();
    if (v) o[k] = v;
  }
  return o;
}

async function postSheet(body: Record<string, unknown>): Promise<void> {
  await fetch("/api/parking-text/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function surveyOptionStyle(selected: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "16px 18px",
    fontSize: "16px",
    lineHeight: 1.4,
    borderRadius: "12px",
    border: selected ? "1px solid #2563EB" : "1px solid #D1D5DB",
    backgroundColor: selected ? "#EFF6FF" : "#F9FAFB",
    color: "#0B1220",
    cursor: "pointer",
    minHeight: "52px",
    boxSizing: "border-box",
  };
}

function usefulOptionStyle(selected: boolean): CSSProperties {
  return {
    flex: "1 1 auto",
    minWidth: "72px",
    padding: "10px 14px",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.3,
    borderRadius: "8px",
    border: selected ? "1px solid #2563EB" : "1px solid #D1D5DB",
    backgroundColor: selected ? "#EFF6FF" : "#FFFFFF",
    color: selected ? "#1D4ED8" : "#374151",
    cursor: "pointer",
    boxSizing: "border-box",
  };
}

function CheckSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section style={styles.checkSection}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <ul style={styles.bulletList}>
        {items.map((text, i) => (
          <li key={`${title}-${i}`} style={styles.bulletItem}>
            <span style={styles.bulletMark} aria-hidden>
              •
            </span>
            <span style={styles.bulletText}>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ParkingTicketTextClient() {
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"survey" | "result">("survey");

  const [q1, setQ1] = useState("");
  const [q1Other, setQ1Other] = useState("");
  const [q2, setQ2] = useState("");
  const [q2Other, setQ2Other] = useState("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState("");

  const [copyLabel, setCopyLabel] = useState("Copy checklist");
  const [validationHint, setValidationHint] = useState("");
  const [checklistUseful, setChecklistUseful] = useState("");
  const [checklistMissingFeedback, setChecklistMissingFeedback] = useState("");

  useEffect(() => {
    setSessionId(newSessionId());
    setMounted(true);
  }, []);

  const branch: ChecklistBranch | null = useMemo(() => {
    if (!q1) return null;
    return checklistBranchFromQ1(q1);
  }, [q1]);

  const concernId = useMemo(() => (q2 ? concernNoteIdFromQ2(q2) : null), [q2]);

  const extraBullet = useMemo(() => {
    if (!concernId || !branch) return null;
    return optionalQ2ExtraBullet(concernId, branch);
  }, [concernId, branch]);

  const sections = useMemo(() => {
    if (!branch) return null;
    return getChecklistSections(branch, extraBullet);
  }, [branch, extraBullet]);

  const q1Label = useMemo(() => q1Options.find((o) => o.id === q1)?.label ?? "", [q1]);
  const q2Label = useMemo(() => q2Options.find((o) => o.id === q2)?.label ?? "", [q2]);
  const q3Label = useMemo(() => q3Options.find((o) => o.id === q3)?.label ?? "", [q3]);

  const plainText = useMemo(() => {
    if (!branch || !concernId || !q1) return "";
    return buildPlainTextChecklist({
      q1Status: q1,
      q1Other,
      concernNoteId: concernId,
      branch,
      extraBullet,
    });
  }, [branch, concernId, q1, q1Other, extraBullet]);

  const submitCompleted = useCallback(() => {
    if (!sessionId || !branch || !concernId) return;
    const utm = getUtm(typeof window !== "undefined" ? window.location.search : "");
    void postSheet({
      action: "submit_completed_survey",
      page_version: PAGE_VERSION,
      checklist_version: CHECKLIST_VERSION,
      privacy_note_version: PRIVACY_NOTE_VERSION,
      concern_note_id: concernId,
      session_id: sessionId,
      utm_source: utm.utm_source ?? "",
      utm_medium: utm.utm_medium ?? "",
      utm_campaign: utm.utm_campaign ?? "",
      utm_content: utm.utm_content ?? "",
      utm_term: utm.utm_term ?? "",
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
      page_url: typeof window !== "undefined" ? window.location.href : "",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      language: LANGUAGE,
      q1_status: q1Label,
      q1_other: q1 === "other" ? q1Other.trim() : "",
      q2_main_concern: q2Label,
      q2_other: q2 === "other" ? q2Other.trim() : "",
      q3_product_discovery: q3Label,
      q4_open_text: q4.trim(),
      checklist_branch: branch,
    });
  }, [
    sessionId,
    branch,
    concernId,
    q1Label,
    q1,
    q1Other,
    q2Label,
    q2,
    q2Other,
    q3Label,
    q4,
  ]);

  const clearValidation = () => setValidationHint("");

  const goNext = () => {
    if (step === 1) {
      if (!q1 || (q1 === "other" && !q1Other.trim())) {
        setValidationHint(validationMessage);
        return;
      }
    }
    if (step === 2) {
      if (!q2 || (q2 === "other" && !q2Other.trim())) {
        setValidationHint(validationMessage);
        return;
      }
    }
    if (step === 3) {
      if (!q3) {
        setValidationHint(validationMessage);
        return;
      }
    }
    clearValidation();
    if (step < 4) {
      setStep((s) => s + 1);
      return;
    }
    if (step === 4) {
      setPhase("result");
      submitCompleted();
    }
  };

  const goBack = () => {
    clearValidation();
    if (step <= 1) return;
    setStep((s) => s - 1);
  };

  const sendChecklistFeedback = useCallback(
    (usefulLabel: string, missingText: string) => {
      if (!sessionId || !usefulLabel) return;
      void postSheet({
        action: "checklist_feedback",
        session_id: sessionId,
        checklist_useful: usefulLabel,
        checklist_missing_feedback: missingText.trim(),
        checklist_feedback_at: new Date().toISOString(),
      });
    },
    [sessionId]
  );

  const onSelectChecklistUseful = (label: string) => {
    setChecklistUseful(label);
    if (label === "Yes") {
      setChecklistMissingFeedback("");
      sendChecklistFeedback(label, "");
    } else {
      sendChecklistFeedback(label, checklistMissingFeedback);
    }
  };

  const onMissingFeedbackBlur = () => {
    if (checklistUseful !== "Somewhat" && checklistUseful !== "No") return;
    sendChecklistFeedback(checklistUseful, checklistMissingFeedback);
  };

  const onCopyChecklist = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy checklist"), 2000);
    } catch {
      setCopyLabel("Copy checklist");
    }
    const ts = new Date().toISOString();
    void postSheet({
      action: "checklist_copied",
      session_id: sessionId,
      copied_checklist_at: ts,
    });
  };

  if (!mounted) return null;

  if (phase === "result" && branch && concernId && sections) {
    const meta = branchMeta[branch];
    const cn = concernNotes[concernId];
    const phrase = q1AnswerPhrase(q1, q1Other);

    return (
      <main style={styles.page}>
        <div style={styles.resultColumn}>
          <div style={styles.card}>
            <h1 style={styles.resultTitle}>Your next-step checklist</h1>
            <p style={styles.intro}>
              Since you {phrase}, here are the safest next steps.
            </p>

            <div style={styles.concernBox}>
              <p style={styles.concernLabel}>About your concern:</p>
              <p style={{ margin: 0 }}>{cn.note}</p>
            </div>

            <CheckSection title="What to do now" items={sections.whatToDoNow} />
            <CheckSection title="What to keep" items={sections.whatToKeep} />
            <CheckSection title="What to know" items={sections.whatToKnow} />
            {sections.whoToContact && sections.whoToContact.length > 0 ? (
              <CheckSection title="Who to contact" items={sections.whoToContact} />
            ) : null}

            <p style={styles.whyLabel}>Why this matters:</p>
            <p style={styles.whyText}>{meta.whyMatters}</p>

            <button type="button" onClick={onCopyChecklist} style={styles.copyChecklistBtn}>
              {copyLabel}
            </button>

            <div style={styles.helpfulNotes}>
              <p style={styles.helpfulNotesTitle}>{helpfulNotesTitle}</p>
              <p style={styles.helpfulLine}>
                <span style={styles.helpfulInlineLead}>{helpfulReportingLabel}</span>{" "}
                {reportingNoteBody}
              </p>
              <p style={{ ...styles.helpfulLine, marginBottom: 0 }}>
                <span style={styles.helpfulInlineLead}>{helpfulGuidanceLabel}</span>{" "}
                {checklistDisclaimer}
              </p>
            </div>

            <section style={styles.usefulFeedback} aria-label="Checklist feedback">
              <p style={styles.usefulQuestion}>{checklistUsefulQuestion}</p>
              <div style={styles.usefulOptions} role="group" aria-label={checklistUsefulQuestion}>
                {checklistUsefulOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelectChecklistUseful(o.label)}
                    style={usefulOptionStyle(checklistUseful === o.label)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {(checklistUseful === "Somewhat" || checklistUseful === "No") && (
                <div style={styles.openBlock}>
                  <label style={styles.usefulMissingLabel} htmlFor="checklist-missing">
                    {checklistMissingLabel}
                  </label>
                  <textarea
                    id="checklist-missing"
                    value={checklistMissingFeedback}
                    onChange={(e) =>
                      setChecklistMissingFeedback(e.target.value.slice(0, MAX_OPEN))
                    }
                    onBlur={onMissingFeedbackBlur}
                    maxLength={MAX_OPEN}
                    rows={3}
                    placeholder={checklistMissingPlaceholder}
                    style={styles.textarea}
                  />
                  <p style={styles.warn}>{openTextWarning}</p>
                </div>
              )}
            </section>

            <div style={styles.ctaSecondaryBlock}>
              <p style={styles.ctaSecondaryLead}>{needAnotherMessageLead}</p>
              <p style={styles.ctaSecondaryLine}>
                <a href="https://scanscam.ca" style={styles.linkMuted}>
                  {postChecklistLine}
                </a>
              </p>
              <p style={styles.ctaSecondaryLine}>
                {contactQuestionsPrefix}{" "}
                <a href={`mailto:${contactEmail}`} style={styles.linkMuted}>
                  {contactEmail}
                </a>
              </p>
            </div>
          </div>

          <p style={styles.privacyOutsideResult}>{privacyNote}</p>
        </div>
      </main>
    );
  }

  const progress = (step / 4) * 100;

  return (
    <main style={styles.page}>
      <div style={styles.heroWrap}>
        <h1 style={styles.heroTitle}>{hero.title}</h1>
        <p style={styles.heroLine}>{hero.sub1}</p>
        <p style={styles.heroLineMuted}>{hero.sub2}</p>
      </div>

      <div style={styles.card}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <p style={styles.stepMeta}>Question {step} of 4</p>

        {step === 1 && (
          <section>
            <h2 style={styles.qTitle}>What have you done with the text so far?</h2>
            <div style={styles.options}>
              {q1Options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setQ1(o.id);
                    clearValidation();
                  }}
                  style={surveyOptionStyle(q1 === o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {q1 === "other" && (
              <div style={styles.openBlock}>
                <label style={styles.label}>What happened?</label>
                <textarea
                  value={q1Other}
                  onChange={(e) => {
                    setQ1Other(e.target.value.slice(0, MAX_OPEN));
                    clearValidation();
                  }}
                  maxLength={MAX_OPEN}
                  rows={4}
                  style={styles.textarea}
                />
                <p style={styles.warn}>{openTextWarning}</p>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 style={styles.qTitle}>What worries you most right now?</h2>
            <div style={styles.options}>
              {q2Options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setQ2(o.id);
                    clearValidation();
                  }}
                  style={surveyOptionStyle(q2 === o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {q2 === "other" && (
              <div style={styles.openBlock}>
                <label style={styles.label}>What worries you most?</label>
                <textarea
                  value={q2Other}
                  onChange={(e) => {
                    setQ2Other(e.target.value.slice(0, MAX_OPEN));
                    clearValidation();
                  }}
                  maxLength={MAX_OPEN}
                  rows={4}
                  style={styles.textarea}
                />
                <p style={styles.warn}>{openTextWarning}</p>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 style={styles.qTitle}>
              What would make ScanScam most useful in a situation like this?
            </h2>
            <div style={styles.options}>
              {q3Options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setQ3(o.id);
                    clearValidation();
                  }}
                  style={surveyOptionStyle(q3 === o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 style={styles.qTitle}>
              If ScanScam could create or help with one thing after this checklist, what should it be?
            </h2>
            <p style={styles.optional}>Optional</p>
            <textarea
              value={q4}
              onChange={(e) => setQ4(e.target.value.slice(0, MAX_OPEN))}
              maxLength={MAX_OPEN}
              rows={5}
              placeholder="Example: a message for my bank, a report I can save, a list of who to contact, or a clearer action plan."
              style={styles.textarea}
            />
            <p style={styles.warn}>{openTextWarning}</p>
          </section>
        )}

        {validationHint ? <p style={styles.validationError}>{validationHint}</p> : null}

        <div style={styles.navRow}>
          {step > 1 ? (
            <button type="button" onClick={goBack} style={styles.backBtn}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={goNext} style={styles.primaryBtn}>
            {step === 4 ? "Continue to my checklist" : "Continue"}
          </button>
        </div>
      </div>

      <p style={styles.privacyBelowSurvey}>{privacyNote}</p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 156px)",
    backgroundColor: "#E2E4E9",
    padding: "24px 16px 40px",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0B1220",
    boxSizing: "border-box",
  },
  resultColumn: {
    maxWidth: "640px",
    margin: "0 auto",
  },
  heroWrap: {
    maxWidth: "640px",
    margin: "0 auto 20px",
    textAlign: "center" as const,
  },
  heroTitle: {
    fontSize: "clamp(26px, 5vw, 34px)",
    fontWeight: 700,
    margin: "0 0 12px",
    lineHeight: 1.2,
  },
  heroLine: {
    fontSize: "17px",
    lineHeight: 1.5,
    color: "#374151",
    margin: "0 0 8px",
  },
  heroLineMuted: {
    fontSize: "16px",
    fontWeight: 500,
    color: "#374151",
    margin: 0,
  },
  card: {
    maxWidth: "640px",
    margin: "0 auto",
    backgroundColor: "#FFFFFF",
    borderRadius: "14px",
    padding: "24px 20px",
    boxShadow: "0 16px 48px rgba(11,18,32,0.18)",
    border: "1px solid #D1D5DB",
    boxSizing: "border-box",
  },
  progressTrack: {
    height: "8px",
    backgroundColor: "#E5E7EB",
    borderRadius: "6px",
    overflow: "hidden",
    marginBottom: "12px",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: "6px",
    transition: "width 0.2s ease",
  },
  stepMeta: {
    fontSize: "14px",
    color: "#6B7280",
    margin: "0 0 16px",
  },
  qTitle: {
    fontSize: "20px",
    fontWeight: 600,
    margin: "0 0 16px",
    lineHeight: 1.35,
  },
  options: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  openBlock: {
    marginTop: "16px",
  },
  label: {
    display: "block",
    fontSize: "15px",
    fontWeight: 500,
    marginBottom: "8px",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: "16px",
    borderRadius: "10px",
    border: "1px solid #D1D5DB",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  warn: {
    fontSize: "12px",
    color: "#6B7280",
    margin: "8px 0 0",
  },
  optional: {
    fontSize: "14px",
    color: "#6B7280",
    margin: "-8px 0 10px",
  },
  validationError: {
    fontSize: "14px",
    color: "#B91C1C",
    margin: "16px 0 0",
  },
  navRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap" as const,
  },
  backBtn: {
    padding: "14px 20px",
    fontSize: "16px",
    fontWeight: 600,
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    cursor: "pointer",
    minHeight: "48px",
  },
  primaryBtn: {
    padding: "14px 22px",
    fontSize: "17px",
    fontWeight: 700,
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    cursor: "pointer",
    minHeight: "48px",
    boxShadow: "0 3px 8px rgba(37,99,235,0.35)",
    marginTop: "4px",
  },
  copyChecklistBtn: {
    padding: "11px 18px",
    fontSize: "15px",
    fontWeight: 600,
    borderRadius: "10px",
    border: "1px solid #2563EB",
    backgroundColor: "#FFFFFF",
    color: "#2563EB",
    cursor: "pointer",
    minHeight: "44px",
    marginTop: "2px",
    marginBottom: "6px",
    alignSelf: "flex-start",
  },
  resultTitle: {
    fontSize: "26px",
    fontWeight: 700,
    margin: "0 0 12px",
    lineHeight: 1.2,
  },
  intro: {
    fontSize: "17px",
    lineHeight: 1.5,
    color: "#374151",
    margin: "0 0 16px",
  },
  concernBox: {
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    borderRadius: "12px",
    padding: "14px 16px",
    marginBottom: "18px",
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#1E3A5F",
  },
  concernLabel: {
    fontWeight: 600,
    margin: "0 0 8px",
    fontSize: "14px",
  },
  checkSection: {
    marginBottom: "28px",
  },
  sectionTitle: {
    fontSize: "17px",
    fontWeight: 600,
    margin: "0 0 12px",
    color: "#1F2937",
    letterSpacing: "-0.01em",
  },
  bulletList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    color: "#374151",
  },
  bulletItem: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    fontSize: "16px",
    lineHeight: 1.55,
    marginBottom: "7px",
  },
  bulletMark: {
    flexShrink: 0,
    color: "#94A3B8",
    fontSize: "15px",
    lineHeight: 1.55,
    userSelect: "none" as const,
    pointerEvents: "none" as const,
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
  },
  whyLabel: {
    fontWeight: 600,
    margin: "4px 0 6px",
    fontSize: "15px",
  },
  whyText: {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#374151",
  },
  helpfulNotes: {
    marginTop: "18px",
    padding: "14px 16px",
    backgroundColor: "#F3F4F6",
    border: "1px solid #E5E7EB",
    borderRadius: "10px",
  },
  helpfulNotesTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 12px",
    letterSpacing: "-0.01em",
  },
  helpfulLine: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#6B7280",
    margin: "0 0 10px",
  },
  helpfulInlineLead: {
    fontWeight: 600,
    color: "#4B5563",
  },
  usefulFeedback: {
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid #E5E7EB",
  },
  usefulQuestion: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#374151",
    margin: "0 0 12px",
  },
  usefulOptions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    marginBottom: "4px",
  },
  usefulMissingLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: "#4B5563",
    marginBottom: "8px",
  },
  ctaSecondaryBlock: {
    marginTop: "16px",
    padding: "12px 14px",
    backgroundColor: "#F9FAFB",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
  },
  ctaSecondaryLead: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#6B7280",
    margin: "0 0 8px",
  },
  ctaSecondaryLine: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#9CA3AF",
    margin: "4px 0",
  },
  linkMuted: {
    color: "#7C9BD4",
    textDecoration: "none",
  },
  privacyBelowSurvey: {
    maxWidth: "640px",
    margin: "16px auto 0",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#6B7280",
    padding: "0 8px",
  },
  privacyOutsideResult: {
    margin: "12px 0 0",
    fontSize: "10px",
    lineHeight: 1.45,
    color: "#9CA3AF",
    textAlign: "center" as const,
  },
};
