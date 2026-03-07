"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_PIN = "/api/internal/pin";
const isDev = process.env.NODE_ENV === "development";

export default function InternalPinGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [apiDebug, setApiDebug] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch(API_PIN, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setUnlocked(true);
        if (isDev) setApiDebug("PIN API reachable");
      })
      .catch((err) => {
        if (isDev) setApiDebug(`PIN API error: ${err?.message ?? String(err)}`);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!unlocked && !checking) inputRef.current?.focus();
  }, [unlocked, checking]);

  const validate = useCallback(async () => {
    setError("");
    const res = await fetch(API_PIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setError("");
      setUnlocked(true);
    } else {
      setError(typeof data?.error === "string" ? data.error : "Incorrect PIN");
    }
  }, [pin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validate();
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Internal Access</h1>
        <p style={styles.subtitle}>Enter PIN to access the intelligence surface</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            placeholder="PIN"
            style={styles.input}
            autoComplete="off"
          />
          <button type="submit" style={styles.button}>
            Submit
          </button>
        </form>
        {error && <p style={styles.error}>{error}</p>}
        {isDev && apiDebug && <p style={styles.debug}>{apiDebug}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#13181d",
    color: "#e6edf3",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "320px",
    padding: "32px",
    background: "#171d24",
    border: "1px solid #30363d",
    borderRadius: "12px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#e6edf3",
  },
  subtitle: {
    margin: "0 0 24px",
    fontSize: "13px",
    color: "#8b949e",
    lineHeight: 1.4,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#e6edf3",
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    marginBottom: "12px",
  },
  button: {
    width: "100%",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#e6edf3",
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "6px",
    cursor: "pointer",
  },
  error: {
    margin: "12px 0 0",
    fontSize: "12px",
    color: "#f85149",
  },
  debug: {
    margin: "12px 0 0",
    fontSize: "11px",
    color: "#8b949e",
  },
};
