"use client";

import { useState } from "react";

const scenarios = {
  bank: {
    label: "Vendor bank change",
    capsule: {
      goal: "Pay the normal ACME invoice",
      proposed_action: {
        type: "change_vendor_bank_account",
        amount: 14300,
        currency: "CAD",
        counterparty_id: "vendor-acme",
        irreversible: true,
        creates_commitment: true,
      },
      principal: {
        mandate: {
          max_autonomous_amount: 25000,
          human_approval_amount: 10000,
          approval_action_types: ["change_vendor_bank_account"],
        },
      },
      previous_state: { vendor: { bank_account: "RBC-8821", email_domain: "acme.ca" } },
      current_state: { vendor: { bank_account: "TD-7742", email_domain: "acme.ca" } },
      claims: [{
        text: "ACME changed banks because of a corporate restructuring",
        material: true,
        evidence: [{ source: "supplier email", verified: true, independent: false }],
      }],
    },
  },
  mandate: {
    label: "Private mandate conflict",
    capsule: {
      goal: "Buy 40 replacement parts",
      proposed_action: {
        type: "place_order",
        amount: 980,
        currency: "CAD",
        counterparty_id: "supplier-zeta",
        creates_commitment: true,
        metadata: { supplier_country: "US" },
      },
      principal: {
        mandate: {
          max_autonomous_amount: 1500,
          approval_action_types: ["place_order"],
          rules: [{
            id: "canada-only-procurement",
            field: "action.metadata.supplier_country",
            operator: "not_in",
            value: ["CA"],
            effect: "require_approval",
            reason: "Principal requires approval before using a non-Canadian supplier.",
          }],
        },
      },
      current_state: { supplier: { country: "US", price: 980 } },
    },
  },
  fee: {
    label: "Agent invents/accepts a fee",
    capsule: {
      goal: "Cancel a flight reservation",
      proposed_action: {
        type: "accept_fee",
        amount: 475,
        currency: "CAD",
        counterparty_id: "airline-agent",
        creates_commitment: true,
      },
      principal: { mandate: { max_autonomous_amount: 1000 } },
      previous_state: { booking: { cancellation_fee: 0 } },
      current_state: { booking: { cancellation_fee: 475 } },
      claims: [{ text: "A $475 cancellation fee applies", material: true, evidence: [] }],
    },
  },
} as const;

type ScenarioKey = keyof typeof scenarios;

type Result = {
  decision?: string;
  risk?: number;
  summary?: string;
  signals?: Array<{ code: string; severity: string; message: string; path?: string }>;
  required_controls?: string[];
};

export default function IntegrityLabPage() {
  const [selected, setSelected] = useState<ScenarioKey>("bank");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenarios[selected].capsule),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? body?.error ?? "Preflight failed");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preflight failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">ScanScam Integrity</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Preflight Lab</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          An independent checkpoint before an autonomous agent crosses a consequential boundary.
          v0.1 is deterministic and does not persist the decision capsule.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {(Object.keys(scenarios) as ScenarioKey[]).map((key) => (
            <button
              key={key}
              onClick={() => { setSelected(key); setResult(null); setError(null); }}
              className={`rounded-2xl border p-4 text-left transition ${
                selected === key
                  ? "border-amber-300 bg-amber-300/10"
                  : "border-slate-700 bg-slate-900 hover:border-slate-500"
              }`}
            >
              <span className="text-sm text-slate-400">Scenario</span>
              <span className="mt-1 block font-medium">{scenarios[key].label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Decision capsule</p>
                <h2 className="mt-1 text-xl font-medium">{scenarios[selected].label}</h2>
              </div>
              <button
                onClick={run}
                disabled={loading}
                className="rounded-full bg-amber-300 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-60"
              >
                {loading ? "Checking…" : "Run preflight"}
              </button>
            </div>
            <pre className="mt-6 max-h-[620px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(scenarios[selected].capsule, null, 2)}
            </pre>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Integrity decision</p>
            {!result && !error ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Run the scenario to see Change, Mandate, Commitment and Verify signals.
              </div>
            ) : null}
            {error ? <p className="mt-6 rounded-2xl bg-red-950/40 p-4 text-red-200">{error}</p> : null}
            {result ? (
              <div className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Decision</p>
                      <p className="mt-1 text-3xl font-semibold">{result.decision}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Risk</p>
                      <p className="mt-1 text-xl font-medium">{Math.round((result.risk ?? 0) * 100)}%</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{result.summary}</p>
                </div>

                <div>
                  <h3 className="font-medium">Signals</h3>
                  <div className="mt-3 space-y-3">
                    {result.signals?.map((signal, index) => (
                      <div key={`${signal.code}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <code className="text-xs text-amber-300">{signal.code}</code>
                          <span className="text-xs uppercase text-slate-500">{signal.severity}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{signal.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Required controls</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.required_controls?.map((control) => (
                      <span key={control} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                        {control}
                      </span>
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
