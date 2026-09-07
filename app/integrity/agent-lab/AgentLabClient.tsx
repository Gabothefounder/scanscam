"use client";

import { useEffect, useMemo, useState } from "react";

type ScenarioMeta = {
  id: string;
  category: string;
  title: string;
  expected_guardian_behavior: string;
  note: string;
};

type LabRun = {
  run_id: string;
  scenario: string;
  category: string;
  title: string;
  expected_guardian_behavior: string;
  proposed_action: Record<string, unknown>;
  proposed_matches_candidate: boolean;
  guardian: {
    decision: string | null;
    disposition: string | null;
    semantic_ran: boolean;
    semantic_model: string | null;
    semantic_estimated_cost_usd: number | null;
    duration_ms: number | null;
    timing_ms?: Record<string, number | string | null>;
  };
  agent: {
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    total_tokens: number | null;
    estimated_cost_usd: number | null;
    proposal_duration_ms: number;
    completion_duration_ms: number | null;
    final_text: string | null;
  };
  execution: {
    executed: boolean;
    committed: boolean;
    receipt_outcome: string | null;
    tool_duration_ms: number | null;
    commit_duration_ms: number | null;
    commit_timing_ms?: Record<string, number | string | null>;
    real_money_moved: false;
  };
  total_duration_ms: number;
};

type CategoryStats = {
  sample_size: number;
  matches: number;
  false_allows: number;
  false_interruptions: number;
  other_mismatches: number;
  decision_match_rate: number | null;
};

type Summary = {
  experiment?: string;
  corpus_size?: number;
  categories?: string[];
  scenarios?: ScenarioMeta[];
  sample_size?: number;
  decision_match_rate?: number | null;
  false_allow_count?: number;
  false_interruption_count?: number;
  other_mismatch_count?: number;
  semantic_escalation_rate?: number | null;
  execution_rate?: number | null;
  commit_rate?: number | null;
  guardian_latency_ms?: { p50?: number | null; p95?: number | null };
  commit_latency_ms?: { p50?: number | null; p95?: number | null };
  total_latency_ms?: { p50?: number | null; p95?: number | null };
  estimated_model_cost_usd?: number;
  estimated_model_cost_per_action_usd?: number | null;
  category_breakdown?: Record<string, CategoryStats>;
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(6)}`;
}

function ms(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)} ms`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function AgentLabClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [runs, setRuns] = useState<LabRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/integrity/v0.8/agent-lab", {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load lab summary.");
    setSummary(body);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function run(input: { scenario?: string; category?: string }) {
    const key = input.category ? `category:${input.category}` : `scenario:${input.scenario}`;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/integrity/v0.8/agent-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...input,
          confirm: "RUN_SYNTHETIC_AGENT_LAB",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Agent lab run failed.");
      const nextRuns: LabRun[] = Array.isArray(body.runs)
        ? body.runs
        : body.run
          ? [body.run]
          : [];
      setRuns(nextRuns);
      setSummary(body.summary ?? summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const scenarios = summary?.scenarios ?? [];
  const categories = summary?.categories ?? [];
  const grouped = useMemo(() => {
    const out: Record<string, ScenarioMeta[]> = {};
    for (const scenario of scenarios) {
      (out[scenario.category] ??= []).push(scenario);
    }
    return out;
  }, [scenarios]);

  const totalCost = useMemo(() => {
    return runs.reduce((sum, run) => {
      return sum +
        (run.agent.estimated_cost_usd ?? 0) +
        (run.guardian.semantic_estimated_cost_usd ?? 0);
    }, 0);
  }, [runs]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex flex-col gap-4 border-b border-white/10 pb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
            ScanScam Integrity · live benchmark
          </div>
          <h1 className="max-w-5xl text-4xl font-semibold tracking-tight md:text-6xl">
            42-scenario Agent Action Lab
          </h1>
          <p className="max-w-4xl text-base leading-7 text-neutral-300 md:text-lg">
            A real model proposes consequential tool calls. Guardian intercepts them through ACS,
            applies principal policy, trusted baseline and evidence, then allows, asks, defers or denies.
          </p>
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Fully synthetic executor. No money moves, no permissions change, no contract is signed,
            and no data is published.
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Corpus" value={String(summary?.corpus_size ?? 42)} />
          <Metric label="Samples" value={String(summary?.sample_size ?? 0)} />
          <Metric label="Decision match" value={pct(summary?.decision_match_rate)} />
          <Metric label="False ALLOW" value={String(summary?.false_allow_count ?? 0)} />
          <Metric label="False interruption" value={String(summary?.false_interruption_count ?? 0)} />
          <Metric label="Semantic" value={pct(summary?.semantic_escalation_rate)} />
        </section>

        <section className="mb-10 grid gap-4 md:grid-cols-4">
          <Metric label="Guardian p50" value={ms(summary?.guardian_latency_ms?.p50)} />
          <Metric label="Guardian p95" value={ms(summary?.guardian_latency_ms?.p95)} />
          <Metric label="Commit p50" value={ms(summary?.commit_latency_ms?.p50)} />
          <Metric label="Est. cost / action" value={money(summary?.estimated_model_cost_per_action_usd)} />
        </section>

        {error ? (
          <div className="mb-8 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mb-12">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Run bounded benchmark cohorts</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Each category runs as one bounded preview invocation instead of forcing all 42 cases into one function.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {categories.map((category) => {
              const stats = summary?.category_breakdown?.[category];
              const count = grouped[category]?.length ?? 0;
              const key = `category:${category}`;
              return (
                <div
                  key={category}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold capitalize">{category}</div>
                      <div className="mt-1 text-sm text-neutral-400">{count} live scenarios</div>
                    </div>
                    <button
                      onClick={() => run({ category })}
                      disabled={busy !== null}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
                    >
                      {busy === key ? "Running…" : "Run cohort"}
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-neutral-400">
                    <div>Samples<br /><span className="text-neutral-200">{stats?.sample_size ?? 0}</span></div>
                    <div>Match<br /><span className="text-neutral-200">{pct(stats?.decision_match_rate)}</span></div>
                    <div>False ALLOW<br /><span className="text-neutral-200">{stats?.false_allows ?? 0}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">Scenario corpus</h2>
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  {category}
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {(grouped[category] ?? []).map((scenario) => {
                    const key = `scenario:${scenario.id}`;
                    return (
                      <button
                        key={scenario.id}
                        onClick={() => run({ scenario: scenario.id })}
                        disabled={busy !== null}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <div className="font-semibold">{scenario.title}</div>
                        <div className="mt-2 text-xs leading-5 text-neutral-400">{scenario.note}</div>
                        <div className="mt-3 text-xs uppercase tracking-wider text-neutral-500">
                          Expected: {scenario.expected_guardian_behavior.toUpperCase()}
                          {busy === key ? " · RUNNING" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {runs.length ? (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Latest cohort</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {runs.length} runs · estimated model cost {money(totalCost)}
              </p>
            </div>

            <div className="space-y-4">
              {runs.map((run) => {
                const matched = run.guardian.decision === run.expected_guardian_behavior;
                return (
                  <article
                    key={run.run_id}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                  >
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-neutral-500">
                          {run.category} · {run.scenario}
                        </div>
                        <div className="mt-1 text-xl font-semibold">{run.title}</div>
                        <div className="mt-2 text-sm text-neutral-400">
                          Expected {run.expected_guardian_behavior.toUpperCase()} · actual{" "}
                          {run.guardian.decision?.toUpperCase() ?? "UNKNOWN"} ·{" "}
                          <span className={matched ? "text-emerald-300" : "text-red-300"}>
                            {matched ? "MATCH" : "MISMATCH"}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                        {run.total_duration_ms} ms end-to-end
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-5">
                      <Metric label="Guardian" value={ms(run.guardian.duration_ms)} />
                      <Metric label="Semantic" value={run.guardian.semantic_ran ? "YES" : "NO"} />
                      <Metric label="Executed" value={run.execution.executed ? "YES" : "NO"} />
                      <Metric label="Committed" value={run.execution.committed ? "YES" : "NO"} />
                      <Metric label="Agent preserved args" value={run.proposed_matches_candidate ? "YES" : "NO"} />
                    </div>

                    <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 md:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
                          Proposed action
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-xs leading-5 text-neutral-300">
                          {JSON.stringify(run.proposed_action, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
                          Agent after Guardian
                        </div>
                        <p className="text-sm leading-6 text-neutral-300">
                          {run.agent.final_text ?? "—"}
                        </p>
                        <div className="mt-3 text-xs text-neutral-500">
                          Agent cost {money(run.agent.estimated_cost_usd)}
                          {run.guardian.semantic_estimated_cost_usd != null
                            ? ` · Guardian semantic cost ${money(run.guardian.semantic_estimated_cost_usd)}`
                            : ""}
                        </div>
                        {run.execution.commit_timing_ms && Object.keys(run.execution.commit_timing_ms).length ? (
                          <div className="mt-3 text-xs text-neutral-500">
                            Commit timing {JSON.stringify(run.execution.commit_timing_ms)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
