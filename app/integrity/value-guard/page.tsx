"use client";

import { useEffect, useMemo, useState } from "react";

type Strength = "light" | "moderate" | "strong" | "very_strong";
type Question = {
  id: string;
  text: string;
  format: "choice" | "text" | "number" | "yes_no";
  options: string[];
  rationale: string;
};

type HardRule = {
  id: string;
  label: string;
  effect: "block" | "require_approval";
  reason: string;
  confidence: number;
};

type Preference = {
  id: string;
  label: string;
  kind: "match" | "minimize" | "maximize";
  mode: "prefer" | "avoid";
  strength: Strength;
  confidence: number;
  private: boolean;
  max_premium_percent: number | null;
  source: string;
};

type Profile = {
  version: "0.6";
  summary: string[];
  hard_rules: HardRule[];
  preferences: Preference[];
  limits: {
    currency: string | null;
    max_autonomous_amount: number | null;
    human_approval_amount: number | null;
    budgets: Array<{
      id: string;
      limit: number;
      currency?: string | null;
      window_seconds: number;
      mode?: "approval" | "deny";
    }>;
  };
  open_questions: string[];
  learned_from_decisions: number;
};

type CoachResponse = {
  profile_id: string;
  principal_id: string;
  status: string;
  question_count: number;
  profile: Profile;
  compiled_mandate: Record<string, unknown>;
  assistant_message: string;
  next_question: Question | null;
  ready_to_publish: boolean;
  model?: string | null;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type SandboxResult = {
  recommended_option_id: string | null;
  results: Array<{
    id: string;
    label: string;
    disposition: "eligible" | "approval_required" | "denied";
    utility: number;
    normalized_score: number;
    matched_preferences: string[];
    tradeoff_notes: string[];
    hard_rule_reasons: string[];
  }>;
};

const STORAGE_KEY = "scanscam_value_guard_profile_v06";

const sampleOptions = [
  {
    id: "a",
    label: "Option A",
    price: 100,
    currency: "CAD",
    effect: "purchase",
    facts: {
      supplier_country: "US",
      brand: "LargeCo",
      privacy: { sells_personal_data: true },
      delivery_days: 2,
      warranty_years: 1,
      flight: { departure_time: "23:30", red_eye: true },
      data_residency: "US",
    },
  },
  {
    id: "b",
    label: "Option B",
    price: 108,
    currency: "CAD",
    effect: "purchase",
    facts: {
      supplier_country: "CA",
      brand: "IndependentCo",
      privacy: { sells_personal_data: false },
      delivery_days: 4,
      warranty_years: 3,
      flight: { departure_time: "09:00", red_eye: false },
      data_residency: "CA",
    },
  },
  {
    id: "c",
    label: "Option C",
    price: 121,
    currency: "CAD",
    effect: "purchase",
    facts: {
      supplier_country: "CA",
      brand: "PremiumCo",
      privacy: { sells_personal_data: false },
      delivery_days: 1,
      warranty_years: 5,
      flight: { departure_time: "14:00", red_eye: false },
      data_residency: "CA",
    },
  },
];

function strengthLabel(strength: Strength): string {
  switch (strength) {
    case "light": return "Light";
    case "moderate": return "Moderate";
    case "strong": return "Strong";
    case "very_strong": return "Very strong";
  }
}

function confidenceLabel(value: number): string {
  if (value >= 0.85) return "High confidence";
  if (value >= 0.6) return "Medium confidence";
  return "Still learning";
}

export default function ValueGuardPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [compiledMandate, setCompiledMandate] = useState<Record<string, unknown> | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [readyToPublish, setReadyToPublish] = useState(false);
  const [status, setStatus] = useState("draft");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<SandboxResult | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const preferenceCount = profile?.preferences.length ?? 0;
  const hardRuleCount = profile?.hard_rules.length ?? 0;

  const completeness = useMemo(() => {
    const structural = Math.min(55, hardRuleCount * 10 + preferenceCount * 8);
    const questions = Math.min(35, questionCount * 6);
    const unresolvedPenalty = Math.min(20, (profile?.open_questions.length ?? 0) * 4);
    return Math.max(8, Math.min(95, structural + questions + 10 - unresolvedPenalty));
  }, [hardRuleCount, preferenceCount, questionCount, profile?.open_questions.length]);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function callCoach(body: Record<string, unknown>): Promise<CoachResponse> {
    const response = await fetch("/api/integrity/v0.6/value-guard/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error ?? "Value Guard coach failed");
    return json as CoachResponse;
  }

  function applyCoach(result: CoachResponse, appendAssistant = true) {
    setProfileId(result.profile_id);
    setProfile(result.profile);
    setCompiledMandate(result.compiled_mandate);
    setQuestion(result.next_question);
    setQuestionCount(result.question_count);
    setReadyToPublish(result.ready_to_publish);
    setStatus(result.status);
    localStorage.setItem(STORAGE_KEY, result.profile_id);

    if (appendAssistant && result.assistant_message) {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.assistant_message },
      ]);
    }
  }

  async function bootstrap(forceNew = false) {
    setLoading(true);
    setError(null);
    setPublishResult(null);
    setSandbox(null);

    try {
      const saved = !forceNew ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        try {
          const loaded = await callCoach({ profile_id: saved });
          applyCoach(loaded);
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      const created = await callCoach({});
      setMessages([]);
      applyCoach(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Value Guard");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(value?: string) {
    const text = (value ?? answer).trim();
    if (!text || !profileId || sending) return;

    setSending(true);
    setError(null);
    setAnswer("");
    setMessages((current) => [...current, { role: "user", text }]);

    try {
      const result = await callCoach({
        profile_id: profileId,
        message: text,
        current_question: question,
      });
      applyCoach(result);
      setSandbox(null);
      setPublishResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update Value Guard");
    } finally {
      setSending(false);
    }
  }

  async function publish() {
    if (!profileId || publishing) return;
    setPublishing(true);
    setError(null);

    try {
      const response = await fetch("/api/integrity/v0.6/value-guard/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Publish failed");
      setStatus("active");
      setPublishResult(
        `Active Guardian mandate v${json.mandate_version}. You can keep teaching the profile and publish another revision later.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  async function runSandbox() {
    if (!profileId || sandboxLoading) return;
    setSandboxLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrity/v0.6/value-guard/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          options: sampleOptions,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Sandbox failed");
      setSandbox(json as SandboxResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run sandbox");
    } finally {
      setSandboxLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">ScanScam Value Guard v0.6</p>
          <h1 className="mt-3 text-4xl font-semibold">Building your private decision profile…</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 border-b border-slate-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">ScanScam Value Guard v0.6</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Teach your agents how you actually want them to decide.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Speak normally. Value Guard separates hard boundaries from preferences, learns trade-offs,
              keeps uncertain preferences uncertain, and compiles the result into a private Guardian policy.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">
              {questionCount} answers
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">
              {hardRuleCount} hard rules
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300">
              {preferenceCount} preferences
            </span>
            <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-violet-200">
              {status === "active" ? "Published" : "Private draft"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/30 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="border-b border-slate-800 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conversation</p>
                  <h2 className="mt-1 text-2xl font-medium">Teach Value Guard</h2>
                </div>
                <button
                  onClick={() => void bootstrap(true)}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
                >
                  Start fresh
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Raw answers are used to compile the turn but are not persisted in the Value Guard database.
              </p>
            </div>

            <div className="max-h-[620px] min-h-[460px] space-y-4 overflow-y-auto p-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "assistant"
                      ? "bg-slate-800 text-slate-200"
                      : "ml-auto bg-violet-300 text-slate-950"
                  }`}
                >
                  {message.text}
                </div>
              ))}

              {question ? (
                <div className="rounded-2xl border border-violet-400/30 bg-violet-400/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Next useful question</p>
                  <p className="mt-2 text-lg font-medium leading-7">{question.text}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{question.rationale}</p>

                  {question.options.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {question.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => void submitAnswer(option)}
                          disabled={sending}
                          className="rounded-full border border-violet-400/30 bg-slate-950 px-4 py-2 text-sm text-violet-100 hover:border-violet-300 disabled:opacity-50"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                  The profile is usable. You can still type corrections or new preferences below at any time.
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 p-5">
              <div className="flex gap-3">
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitAnswer();
                    }
                  }}
                  placeholder={
                    question
                      ? "Answer naturally — no weights or configuration syntax needed."
                      : "Add or correct anything: “Actually, privacy matters more than speed…”"
                  }
                  rows={3}
                  className="min-h-[82px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400"
                />
                <button
                  onClick={() => void submitAnswer()}
                  disabled={!answer.trim() || sending}
                  className="self-end rounded-full bg-violet-300 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-40"
                >
                  {sending ? "Learning…" : "Send"}
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current model</p>
                  <h2 className="mt-1 text-2xl font-medium">How your agent understands you</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Profile maturity</p>
                  <p className="mt-1 text-xl font-semibold">{completeness}%</p>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-300 transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>

              {profile?.summary.length ? (
                <div className="mt-6 space-y-2">
                  {profile.summary.map((item) => (
                    <div key={item} className="rounded-xl bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                  Answer the first question and the profile will start appearing here.
                </p>
              )}

              {profile?.hard_rules.length ? (
                <div className="mt-7">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-300">Hard boundaries</h3>
                  <div className="mt-3 space-y-3">
                    {profile.hard_rules.map((rule) => (
                      <div key={rule.id} className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{rule.label}</p>
                          <span className="rounded-full border border-rose-700/50 px-2.5 py-1 text-[11px] uppercase text-rose-200">
                            {rule.effect === "block" ? "Never" : "Ask first"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{confidenceLabel(rule.confidence)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {profile?.preferences.length ? (
                <div className="mt-7">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-300">Preferences</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {profile.preferences.map((preference) => (
                      <div key={preference.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <p className="font-medium">{preference.label}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
                            {strengthLabel(preference.strength)}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">
                            {confidenceLabel(preference.confidence)}
                          </span>
                          {preference.max_premium_percent !== null ? (
                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
                              ~{preference.max_premium_percent}% trade-off
                            </span>
                          ) : null}
                          {preference.private ? (
                            <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-200">
                              private
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {profile?.open_questions.length ? (
                <div className="mt-7 rounded-2xl border border-amber-800/40 bg-amber-950/10 p-4">
                  <p className="text-sm font-medium text-amber-200">Still uncertain</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-400">
                    {profile.open_questions.slice(0, 4).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => void publish()}
                  disabled={publishing || (!readyToPublish && hardRuleCount + preferenceCount === 0)}
                  className="rounded-full bg-emerald-300 px-5 py-2.5 font-semibold text-slate-950 disabled:opacity-40"
                >
                  {publishing ? "Publishing…" : status === "active" ? "Publish new revision" : "Publish to Guardian"}
                </button>
                <button
                  onClick={() => void runSandbox()}
                  disabled={sandboxLoading || !profileId}
                  className="rounded-full border border-slate-700 px-5 py-2.5 font-medium text-slate-200 disabled:opacity-40"
                >
                  {sandboxLoading ? "Comparing…" : "Try decision sandbox"}
                </button>
              </div>

              {publishResult ? (
                <p className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">
                  {publishResult}
                </p>
              ) : null}
            </section>

            {sandbox ? (
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Not a buying agent</p>
                    <h2 className="mt-1 text-xl font-medium">Decision sandbox</h2>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                    supplied options only
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Same three sample options, scored against your current profile. Value Guard does not search or transact.
                </p>

                <div className="mt-5 space-y-3">
                  {[...sandbox.results]
                    .sort((a, b) => b.normalized_score - a.normalized_score)
                    .map((result) => (
                      <div
                        key={result.id}
                        className={`rounded-2xl border p-4 ${
                          result.id === sandbox.recommended_option_id
                            ? "border-emerald-400/50 bg-emerald-400/5"
                            : "border-slate-800 bg-slate-950"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">
                              {result.label}
                              {result.id === sandbox.recommended_option_id ? " · preferred" : ""}
                            </p>
                            <p className="mt-1 text-xs uppercase text-slate-500">{result.disposition.replace("_", " ")}</p>
                          </div>
                          <p className="text-2xl font-semibold">{Math.round(result.normalized_score)}</p>
                        </div>

                        {result.matched_preferences.length ? (
                          <p className="mt-3 text-sm leading-6 text-slate-400">
                            Matches: {result.matched_preferences.join(", ")}
                          </p>
                        ) : null}
                        {result.hard_rule_reasons.length ? (
                          <p className="mt-2 text-sm leading-6 text-rose-300">
                            {result.hard_rule_reasons.join(" ")}
                          </p>
                        ) : null}
                        {result.tradeoff_notes.length ? (
                          <p className="mt-2 text-sm leading-6 text-amber-200">
                            {result.tradeoff_notes.join(" ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>

                <details className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-300">
                    See the sample facts
                  </summary>
                  <pre className="mt-4 max-h-72 overflow-auto text-xs leading-6 text-slate-500">
                    {JSON.stringify(sampleOptions, null, 2)}
                  </pre>
                </details>
              </section>
            ) : null}

            <details className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <summary className="cursor-pointer text-sm font-medium text-slate-300">
                Advanced: see the compiled machine policy
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This is where the internal coefficients live. People should not need to configure this directly.
              </p>
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-violet-200">
                {JSON.stringify(compiledMandate, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}
