"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "internalRadarUnlocked";

export default function InternalPinGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setUnlocked(stored === "true");
  }, []);

  useEffect(() => {
    if (!unlocked) {
      inputRef.current?.focus();
    }
  }, [unlocked]);

  const validate = useCallback(() => {
    const expected = process.env.NEXT_PUBLIC_INTERNAL_RADAR_PIN ?? "";
    if (pin === expected) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, "true");
      }
      setError("");
      setUnlocked(true);
    } else {
      setError("Incorrect PIN");
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
};
