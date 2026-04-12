"use client";

import { useState } from "react";

export type ContextRefinementStrings = {
  collapsedTitle: string;
  collapsedHint: string;
  expandLink: string;
  collapseLink: string;
  fieldLabel: string;
  fieldHint: string;
  examplesLabel: string;
  placeholder: string;
  submitLabel: string;
  loadingLabel: string;
};

type ContextRefinementCardProps = {
  mode: "required" | "suggested";
  strings: ContextRefinementStrings;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  /** Single example line; omit or pass null/empty to hide examples. */
  exampleSingle?: string | null;
  /** When true, omits redundant titles (parent owns preliminary copy). */
  compact?: boolean;
  tone?: "default" | "light";
  /** When true, user expands to see the form (optional refinement). */
  collapsible?: boolean;
  /** Initial expanded state when collapsible (required flows stay open). */
  defaultExpanded?: boolean;
  /** Stronger label + textarea styling for the weak-input gate. */
  gateProminentInput?: boolean;
};

export function ContextRefinementCard({
  mode,
  strings,
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  error,
  exampleSingle = null,
  compact = false,
  tone = "default",
  collapsible = false,
  defaultExpanded = false,
  gateProminentInput = false,
}: ContextRefinementCardProps) {
  const [expanded, setExpanded] = useState(collapsible ? defaultExpanded : true);

  const showForm = !collapsible || expanded;

  const shell =
    tone === "light"
      ? {
          border: "1px solid #D1D5DB",
          backgroundColor: "#ECEEF2",
          borderRadius: 8,
          padding: "10px 12px",
          gap: 8 as const,
        }
      : gateProminentInput && mode === "required"
        ? {
            border: "1px solid #D1D5DB",
            backgroundColor: "#FFFBF5",
            borderRadius: 10,
            padding: "20px 22px",
            gap: 12 as const,
          }
        : {
            border: mode === "required" ? "1px solid #E5D0A8" : "1px solid #D1D5DB",
            backgroundColor: mode === "required" ? "#FFFBF5" : "#ECEEF2",
            borderRadius: 10,
            padding: "12px 14px",
            gap: 8 as const,
          };

  const secondaryButton = {
    width: "100%" as const,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    padding: tone === "light" ? "9px 12px" : "10px 14px",
    fontWeight: 600 as const,
    fontSize: tone === "light" ? 13 : 14,
    cursor: disabled || loading ? ("not-allowed" as const) : ("pointer" as const),
    opacity: disabled || loading ? 0.65 : 1,
  };

  const requiredAccentButton = {
    ...secondaryButton,
    border: "1px solid #D97706",
    backgroundColor: "#FFFBEB",
    color: "#92400E",
  };

  const gatePrimaryCta =
    gateProminentInput && mode === "required" && tone !== "light"
      ? {
          ...requiredAccentButton,
          border: "1px solid #9A3412",
          backgroundColor: "#FED7AA",
          color: "#7C2D12",
          padding: "12px 16px",
          fontSize: 15,
          fontWeight: 700,
          boxShadow: "0 2px 5px rgba(124, 45, 18, 0.18)",
        }
      : null;

  const submitStyle =
    gatePrimaryCta ?? (mode === "required" && tone !== "light" ? requiredAccentButton : secondaryButton);

  return (
    <section
      style={{
        ...shell,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {collapsible && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            padding: 0,
            margin: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left" as const,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{strings.collapsedTitle}</span>
          <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.4 }}>{strings.collapsedHint}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", marginTop: 2 }}>
            {strings.expandLink}
          </span>
        </button>
      )}

      {showForm && (
        <>
          {collapsible && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                alignSelf: "flex-start",
                border: "none",
                background: "transparent",
                padding: 0,
                margin: "0 0 4px",
                fontSize: 12,
                fontWeight: 600,
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              {strings.collapseLink}
            </button>
          )}

          {!compact && !collapsible && (
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>{strings.fieldLabel}</h3>
          )}
          {compact && !collapsible && (
            <h3
              style={{
                margin: 0,
                fontSize: gateProminentInput ? 18 : 15,
                fontWeight: gateProminentInput ? 700 : 600,
                color: "#111827",
                letterSpacing: gateProminentInput ? "-0.01em" : undefined,
              }}
            >
              {strings.fieldLabel}
            </h3>
          )}
          {collapsible && expanded && (
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{strings.fieldLabel}</h3>
          )}

          <p
            style={{
              margin: 0,
              fontSize: gateProminentInput ? 14 : 13,
              color: "#4B5563",
              lineHeight: 1.45,
              fontWeight: gateProminentInput ? 500 : 400,
            }}
          >
            {strings.fieldHint}
          </p>

          {exampleSingle && exampleSingle.trim().length > 0 ? (
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                {strings.examplesLabel}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>
                &ldquo;{exampleSingle}&rdquo;
              </p>
            </div>
          ) : null}

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={strings.placeholder}
            rows={gateProminentInput ? 5 : tone === "light" ? 2 : 3}
            className={gateProminentInput ? "weak-gate-textarea" : undefined}
            style={{
              width: "100%",
              marginTop: gateProminentInput ? 14 : 0,
              borderRadius: 8,
              border: gateProminentInput ? undefined : "1px solid #D1D5DB",
              padding: gateProminentInput ? undefined : "10px 12px",
              fontSize: 14,
              color: "#111827",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              backgroundColor: "#FFFFFF",
            }}
            autoComplete="off"
          />
          {error ? (
            <p style={{ margin: 0, color: "#B91C1C", fontSize: 12 }}>{error}</p>
          ) : null}
          <button type="button" onClick={onSubmit} disabled={disabled || loading} style={submitStyle}>
            {loading ? strings.loadingLabel : strings.submitLabel}
          </button>
        </>
      )}
    </section>
  );
}
