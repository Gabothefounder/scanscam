"use client";

import { useEffect, useMemo, useState } from "react";

type DemoStep = {
  id: number;
  eyebrow: string;
  title: string;
  body: string;
};

const steps: DemoStep[] = [
  {
    id: 0,
    eyebrow: "1 · Principal mandate",
    title: "The agent is allowed to pay routine invoices.",
    body:
      "ACME is an established supplier. Payments under CAD 2,500 may be handled automatically when identity and payment instructions are unchanged.",
  },
  {
    id: 1,
    eyebrow: "2 · Something changed",
    title: "The invoice amount is routine. The bank account is not.",
    body:
      "A message says ACME moved its payments from RBC-1111 to TD-ATTACKER. The agent is ready to pay CAD 300.",
  },
  {
    id: 2,
    eyebrow: "3 · Independent preflight",
    title: "ScanScam compares the action with the trusted baseline.",
    body:
      "Guardian sees a changed payment destination and no independent evidence confirming the change.",
  },
  {
    id: 3,
    eyebrow: "4 · Challenge",
    title: "The payment stops before money moves.",
    body:
      "ScanScam returns CHALLENGE. The agent cannot treat the email that announced the bank change as proof of the same bank change.",
  },
  {
    id: 4,
    eyebrow: "5 · Independent verification",
    title: "A trusted verifier confirms the new destination.",
    body:
      "Fresh evidence arrives through an independent channel. The same proposed action is evaluated again.",
  },
  {
    id: 5,
    eyebrow: "6 · Exact authorization + receipt",
    title: "The agent may execute only the action that was approved.",
    body:
      "Guardian returns ALLOW with an authorization bound to the exact action. After sandbox execution, Commit produces an auditable receipt.",
  },
];

const paperTrail = [
  {
    label: "Observation",
    value: "pay_invoice · ACME · CAD 300 · TD-ATTACKER",
  },
  {
    label: "Baseline",
    value: "ACME · RBC-1111",
  },
  {
    label: "Challenge",
    value: "Payment destination changed. Independent verification required.",
  },
  {
    label: "Evidence",
    value: "Fresh independent verification received.",
  },
  {
    label: "Authorization",
    value: "Bound to exact action hash · one-time",
  },
  {
    label: "Commit",
    value: "Execution receipt recorded · exact action preserved",
  },
];

function badgeClass(active: boolean, complete: boolean) {
  if (active) {
    return "border-cyan-300/60 bg-cyan-300/10 text-cyan-100";
  }
  if (complete) {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-500";
}

function decision(step: number) {
  if (step < 2) return { label: "WAITING", cls: "border-slate-700 text-slate-400" };
  if (step < 4) return { label: "CHALLENGE", cls: "border-amber-400/50 bg-amber-400/10 text-amber-200" };
  if (step === 4) return { label: "RECHECK", cls: "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" };
  return { label: "ALLOW", cls: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" };
}

export default function IntegrityDemoPage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= steps.length - 1) {
      setPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [playing, step]);

  const current = steps[step];
  const state = decision(step);

  const visibleTrail = useMemo(() => {
    if (step === 0) return 0;
    if (step === 1) return 1;
    if (step === 2) return 2;
    if (step === 3) return 3;
    if (step === 4) return 4;
    return 6;
  }, [step]);

  function restart() {
    setPlaying(false);
    setStep(0);
  }

  function run() {
    if (step >= steps.length - 1) setStep(0);
    setPlaying(true);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="border-b border-slate-800 pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                ScanScam Integrity · 3-minute demo
              </p>
              <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-tight sm:text-6xl">
                The agent is allowed to pay.
                <span className="block text-slate-400">The bank account changed.</span>
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                ScanScam is an independent checkpoint between an autonomous agent
                and a consequential action. It looks for changed facts, broken
                mandates, missing verification, and binding consequences before
                the action crosses the boundary.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={run}
                className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {playing ? "Running…" : step === steps.length - 1 ? "Run again" : "Run demo"}
              </button>
              <button
                onClick={restart}
                className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Current moment
                  </p>
                  <p className="mt-2 text-sm text-cyan-300">{current.eyebrow}</p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.14em] ${state.cls}`}>
                  {state.label}
                </span>
              </div>

              <h2 className="mt-6 text-3xl font-semibold tracking-tight">
                {current.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                {current.body}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trusted baseline</p>
                  <p className="mt-2 font-mono text-sm text-slate-200">vendor: ACME</p>
                  <p className="mt-1 font-mono text-sm text-slate-200">bank: RBC-1111</p>
                  <p className="mt-1 font-mono text-sm text-slate-200">amount: CAD 300</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Proposed action</p>
                  <p className="mt-2 font-mono text-sm text-slate-200">vendor: ACME</p>
                  <p className={`mt-1 font-mono text-sm ${step >= 1 ? "text-amber-200" : "text-slate-200"}`}>
                    bank: {step >= 1 ? "TD-ATTACKER" : "RBC-1111"}
                  </p>
                  <p className="mt-1 font-mono text-sm text-slate-200">amount: CAD 300</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Principal mandate</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Pay established suppliers automatically below CAD 2,500 when
                  identity and payment instructions are unchanged. Require
                  independent verification when a payment destination changes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-2xl font-semibold">20/20</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">external-agent benchmark decisions</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-2xl font-semibold">0</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">dangerous false ALLOWs in that sample</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-2xl font-semibold">8/8</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">ALLOW paths committed exactly</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                What happens
              </p>

              <div className="mt-6 space-y-3">
                {steps.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setPlaying(false);
                      setStep(index);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${badgeClass(index === step, index < step)}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 opacity-70">{item.body}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Audit trail
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">A paper trail machines can verify.</h2>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400">
                  synthetic demo
                </span>
              </div>

              <div className="mt-6 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/60">
                {paperTrail.map((item, index) => {
                  const visible = index < visibleTrail;
                  return (
                    <div key={item.label} className="grid gap-2 p-4 sm:grid-cols-[120px_1fr]">
                      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${visible ? "text-cyan-300" : "text-slate-700"}`}>
                        {item.label}
                      </p>
                      <p className={`font-mono text-xs leading-5 ${visible ? "text-slate-300" : "text-slate-700"}`}>
                        {visible ? item.value : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                The point
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                ScanScam does not need to be the buying agent.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Any agent can call ScanScam immediately before a payment,
                purchase, publication, permission change, contract, or other
                consequential action. Guardian is the independent preflight
                layer.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                ["Discover", "Agent finds ScanScam through an MCP registry or direct configuration."],
                ["Preflight", "Agent sends the independently observed action to Guardian."],
                ["Decide", "ALLOW · CHALLENGE · APPROVAL_REQUIRED · DENY."],
                ["Commit", "Only an exact ALLOW action can settle with an execution receipt."],
              ].map(([label, text]) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold text-slate-100">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Demo actions are synthetic. No real money, permissions, contracts, or data are changed.
          </p>
          <p>ScanScam Integrity · independent preflight for autonomous agents</p>
        </footer>
      </div>
    </main>
  );
}
