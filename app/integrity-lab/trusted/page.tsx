"use client";

import { useState } from "react";

const VALID_ATTESTATION_ID = "8ff0fe25-eeef-4b10-a54c-b5c6887bd256";

const scenarios = {
  safe: {
    label: "Safe known payment",
    body: {
      principal_id: "demo-gabriel",
      subject_id: "known-payee",
      proposed_action: { type: "send_payment", amount: 300, currency: "CAD", counterparty_id: "known-payee" },
      current_state: { vendor: { bank_account: "RBC-1111", typical_amount: 2400 } },
      trace_excerpt: "Pay the routine invoice to the established supplier account.",
      semantic_mode: "off",
    },
  },
  spoofMandate: {
    label: "Agent spoofs mandate",
    body: {
      principal_id: "demo-gabriel",
      subject_id: "known-payee",
      proposed_action: { type: "send_payment", amount: 6000, currency: "CAD", counterparty_id: "known-payee" },
      current_state: { vendor: { bank_account: "RBC-1111", typical_amount: 2400 } },
      trace_excerpt: "Pay the known supplier invoice.",
      semantic_mode: "off",
      principal: { mandate: { currency: "CAD", max_autonomous_amount: 10000 } },
    },
  },
  spoofHistory: {
    label: "Agent spoofs history",
    body: {
      principal_id: "demo-gabriel",
      subject_id: "vendor-acme",
      proposed_action: { type: "send_payment", amount: 1200, currency: "CAD", counterparty_id: "vendor-acme" },
      current_state: { vendor: { bank_account: "TD-7742", email_domain: "acme.ca", typical_amount: 1200 } },
      previous_state: { vendor: { bank_account: "TD-7742", email_domain: "acme.ca", typical_amount: 1200 } },
      trace_excerpt: "ACME says its banking instructions changed and asks us to use the new account.",
      semantic_mode: "off",
    },
  },
  attested: {
    label: "Valid attestation",
    body: {
      principal_id: "demo-gabriel",
      proposed_action: { type: "draft_report" },
      attestation_ids: [VALID_ATTESTATION_ID],
      semantic_mode: "off",
    },
  },
  semantic: {
    label: "Goal/action mismatch",
    body: {
      principal_id: "demo-gabriel",
      subject_id: "known-payee",
      goal: "Book a hotel in Montreal for under 300 CAD.",
      proposed_action: { type: "send_payment", amount: 250, currency: "CAD", counterparty_id: "known-payee" },
      current_state: { vendor: { bank_account: "RBC-1111", typical_amount: 2400 } },
      trace_excerpt: "The next step selected is to transfer 250 CAD to a cryptocurrency exchange.",
      semantic_mode: "on",
    },
  },
} as const;

type Key = keyof typeof scenarios;

export default function TrustedIntegrityLab() {
  const [selected, setSelected] = useState<Key>("spoofMandate");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/preflight/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenarios[selected].body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Trusted preflight failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trusted preflight failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">ScanScam Integrity v0.2</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Trusted Inputs Lab</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          The acting agent reports the proposed action. ScanScam resolves the authoritative mandate,
          prior state and attestations server-side, then builds the decision capsule itself.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(scenarios) as Key[]).map((key) => (
            <button
              key={key}
              onClick={() => { setSelected(key); setResult(null); setError(null); }}
              className={`rounded-2xl border p-4 text-left ${
                selected === key ? "border-emerald-300 bg-emerald-300/10" : "border-slate-700 bg-slate-900"
              }`}
            >
              <span className="text-xs uppercase text-slate-500">Attack/demo</span>
              <span className="mt-1 block text-sm font-medium">{scenarios[key].label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-medium">Caller request</h2>
              <button
                onClick={run}
                disabled={loading}
                className="rounded-full bg-emerald-300 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-60"
              >
                {loading ? "Resolving trust…" : "Run v0.2"}
              </button>
            </div>
            <pre className="mt-5 max-h-[680px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(scenarios[selected].body, null, 2)}
            </pre>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-medium">Server-built decision</h2>
            {error ? <p className="mt-5 rounded-xl bg-red-950/40 p-4 text-red-200">{error}</p> : null}
            {!result && !error ? (
              <p className="mt-5 rounded-2xl border border-dashed border-slate-700 p-8 text-slate-400">
                Run a scenario. Spoofed <code>principal</code> and <code>previous_state</code> fields should appear under ignored client authority.
              </p>
            ) : null}
            {result ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl bg-slate-950 p-5">
                  <div className="flex justify-between gap-6">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Decision</p>
                      <p className="mt-1 text-3xl font-semibold">{result.decision}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase text-slate-500">Risk</p>
                      <p className="mt-1 text-xl">{Math.round((result.risk ?? 0) * 100)}%</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">Trusted resolution</p>
                  <pre className="mt-2 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-200">
                    {JSON.stringify(result.trust, null, 2)}
                  </pre>
                </div>

                <div>
                  <p className="text-sm font-medium">Signals</p>
                  <div className="mt-2 space-y-2">
                    {(result.signals ?? []).map((signal: any, index: number) => (
                      <div key={index} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <code className="text-xs text-emerald-300">{signal.code}</code>
                        <p className="mt-1 text-sm text-slate-300">{signal.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
