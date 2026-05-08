"use client";

import { useEffect, useState } from "react";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

type Lang = "en" | "fr";

const Q1_VALUES = [
  "quick_check",
  "suspicious_message",
  "suspicious_call",
  "pressure_to_act",
  "already_acted",
  "checking_for_someone_else",
  "report_or_keep_proof",
  "work_or_client",
  "other",
] as const;
type Q1Id = (typeof Q1_VALUES)[number];

const Q3_VALUES = [
  "risk_check",
  "suspicious_signals",
  "next_step",
  "share_report",
  "report_scam",
  "limit_damage",
  "guided_until_resolved",
  "human_case_support",
  "deeper_check",
  "protect_others",
  "other",
] as const;
type Q3Id = (typeof Q3_VALUES)[number];

const Q4_VALUES = [
  "free_only",
  "price_0_5",
  "price_5_10",
  "price_10_25",
  "around_50",
  "monthly_5_10",
  "monthly_10_20",
  "monthly_50_plus",
  "high_end_150_500",
  "not_sure",
] as const;
type Q4Id = (typeof Q4_VALUES)[number];

const TOTAL_STEPS = 4;
const MAX_HELP_OPTIONS = 3;
const MIN_PROBLEM_LEN = 8;
const MAX_PROBLEM_LEN = 2000;

type CopyPack = {
  q1Title: string;
  q1: Record<Q1Id, string>;
  q2Title: string;
  q2Placeholder: string;
  q2Microcopy: string;
  q3Title: string;
  q3Note: string;
  q3: Record<Q3Id, string>;
  q3OtherLabel: string;
  q4Title: string;
  q4: Record<Q4Id, string>;
  privacyNote: string;
  questionsBadge: string;
  next: string;
  back: string;
  submit: string;
  errQ1: string;
  errQ2: string;
  errQ3: string;
  errQ4: string;
  errSelectAtMost: string;
  errSubmit: string;
  progressLabel: (current: number, total: number) => string;
};

const copy: Record<Lang, CopyPack> = {
  en: {
    q1Title: "What best describes your situation?",
    q1: {
      quick_check: "I just want to quickly check something",
      suspicious_message: "I received a suspicious message, email, or text",
      suspicious_call: "I received a suspicious call",
      pressure_to_act: "I\u2019m being pushed to click, reply, pay, or share info",
      already_acted: "I already clicked, replied, paid, or shared something",
      checking_for_someone_else: "I\u2019m checking for someone close to me",
      report_or_keep_proof: "I want to report the scam or keep proof",
      work_or_client: "I\u2019m checking for work or a client",
      other: "Other",
    },
    q2Title: "In a few words, what worries you or what are you trying to solve?",
    q2Placeholder:
      "Example: \u201CI clicked and don\u2019t know what to do,\u201D \u201Cmy mother gets suspicious texts,\u201D \u201Csomeone says they\u2019re from my bank,\u201D \u201CI want to know if I should report it.\u201D",
    q2Microcopy: "Write it like you would explain it to a friend.",
    q3Title: "What kind of help would be most useful to you?",
    q3Note: "Choose up to 3.",
    q3: {
      risk_check: "Tell me if it seems risky or not",
      suspicious_signals: "Show me what looks suspicious",
      next_step: "Tell me what to do next",
      share_report: "Give me a report to share",
      report_scam: "Help me report the scam",
      limit_damage: "Help me limit damage or recover money",
      guided_until_resolved: "Guide me step by step until it is resolved",
      human_case_support: "Let me speak with someone who knows my case",
      deeper_check: "Do a deeper check",
      protect_others: "Help me protect other people",
      other: "Other",
    },
    q3OtherLabel: "What kind of help would you want?",
    q4Title: "If ScanScam truly solved your problem, what price would feel fair?",
    q4: {
      free_only: "Free only",
      price_0_5: "$0\u2013$5",
      price_5_10: "$5\u2013$10",
      price_10_25: "$10\u2013$25",
      around_50: "Around $50",
      monthly_5_10: "$5\u2013$10/month",
      monthly_10_20: "$10\u2013$20/month",
      monthly_50_plus: "$50+/month",
      high_end_150_500: "$150\u2013$500 for very specific help",
      not_sure: "I\u2019m not sure",
    },
    privacyNote:
      "Please do not include sensitive personal information such as passwords, banking details, verification codes, or government ID numbers.",
    questionsBadge: "4 short questions \u2014 about 30 seconds",
    next: "Next",
    back: "Back",
    submit: "Unlock the full report",
    errQ1: "Please choose an option for question 1.",
    errQ2: "Please write a few words about what worries you.",
    errQ3: "Please choose at least one type of help.",
    errQ4: "Please choose an option for question 4.",
    errSelectAtMost: `Please select at most ${MAX_HELP_OPTIONS} options.`,
    errSubmit: "Something went wrong. Please try again.",
    progressLabel: (c, t) => `Question ${c} of ${t}`,
  },
  fr: {
    q1Title: "Qu\u2019est-ce qui ressemble le plus \u00E0 votre situation ?",
    q1: {
      quick_check: "Je veux seulement v\u00E9rifier rapidement quelque chose",
      suspicious_message: "J\u2019ai re\u00E7u un message, courriel ou texto suspect",
      suspicious_call: "J\u2019ai re\u00E7u un appel suspect",
      pressure_to_act: "On me presse de cliquer, r\u00E9pondre, payer ou partager des infos",
      already_acted: "J\u2019ai d\u00E9j\u00E0 cliqu\u00E9, r\u00E9pondu, pay\u00E9 ou partag\u00E9 quelque chose",
      checking_for_someone_else: "Je v\u00E9rifie pour un proche",
      report_or_keep_proof: "Je veux signaler la fraude ou garder une preuve",
      work_or_client: "Je v\u00E9rifie pour le travail ou un client",
      other: "Autre",
    },
    q2Title:
      "En quelques mots, qu\u2019est-ce qui vous inqui\u00E8te ou qu\u2019essayez-vous de r\u00E9gler ?",
    q2Placeholder:
      "Exemple : \u201Cj\u2019ai cliqu\u00E9 et je ne sais pas quoi faire\u201D, \u201Cma m\u00E8re re\u00E7oit des textos suspects\u201D, \u201Cquelqu\u2019un dit \u00EAtre de ma banque\u201D, \u201Cje veux savoir si je dois signaler\u201D.",
    q2Microcopy: "\u00C9crivez comme vous l\u2019expliqueriez \u00E0 un ami.",
    q3Title: "Quel type d\u2019aide vous serait le plus utile ?",
    q3Note: "Choisissez jusqu\u2019\u00E0 3 r\u00E9ponses.",
    q3: {
      risk_check: "Me dire si \u00E7a semble risqu\u00E9 ou non",
      suspicious_signals: "Me montrer ce qui semble louche",
      next_step: "Me dire quoi faire ensuite",
      share_report: "Me donner un rapport \u00E0 partager",
      report_scam: "M\u2019aider \u00E0 signaler la fraude",
      limit_damage: "M\u2019aider \u00E0 limiter les d\u00E9g\u00E2ts ou r\u00E9cup\u00E9rer mon argent",
      guided_until_resolved: "Me guider \u00E9tape par \u00E9tape jusqu\u2019\u00E0 ce que ce soit r\u00E9gl\u00E9",
      human_case_support: "Me permettre de parler \u00E0 quelqu\u2019un qui conna\u00EEt mon dossier",
      deeper_check: "Faire une recherche plus pouss\u00E9e",
      protect_others: "M\u2019aider \u00E0 prot\u00E9ger d\u2019autres personnes",
      other: "Autre",
    },
    q3OtherLabel: "Quel type d\u2019aide aimeriez-vous ?",
    q4Title: "Si ScanScam r\u00E9glait vraiment votre probl\u00E8me, quel prix semblerait juste ?",
    q4: {
      free_only: "Gratuit seulement",
      price_0_5: "0 $ \u00E0 5 $",
      price_5_10: "5 $ \u00E0 10 $",
      price_10_25: "10 $ \u00E0 25 $",
      around_50: "Environ 50 $",
      monthly_5_10: "5 $ \u00E0 10 $ / mois",
      monthly_10_20: "10 $ \u00E0 20 $ / mois",
      monthly_50_plus: "50 $+ / mois",
      high_end_150_500: "150 $ \u00E0 500 $ pour une aide tr\u00E8s sp\u00E9cifique",
      not_sure: "Je ne suis pas certain",
    },
    privacyNote:
      "Veuillez ne pas inclure d\u2019informations personnelles sensibles telles que mots de passe, donn\u00E9es bancaires, codes de v\u00E9rification ou num\u00E9ros d\u2019identit\u00E9 gouvernementaux.",
    questionsBadge: "4 questions courtes \u2014 environ 30 secondes",
    next: "Suivant",
    back: "Retour",
    submit: "D\u00E9bloquer le rapport complet",
    errQ1: "Veuillez choisir une r\u00E9ponse \u00E0 la question 1.",
    errQ2: "Veuillez \u00E9crire quelques mots sur ce qui vous inqui\u00E8te.",
    errQ3: "Veuillez choisir au moins un type d\u2019aide.",
    errQ4: "Veuillez choisir une r\u00E9ponse \u00E0 la question 4.",
    errSelectAtMost: `Veuillez s\u00E9lectionner au plus ${MAX_HELP_OPTIONS} r\u00E9ponses.`,
    errSubmit: "Une erreur s\u2019est produite. Veuillez r\u00E9essayer.",
    progressLabel: (c, t) => `Question ${c} sur ${t}`,
  },
};

export type UserResearchGateProps = {
  scanId: string;
  lang: Lang;
  riskTier?: string;
  /** Called once the API returns a tokenized report URL. The parent owns navigation + final telemetry. */
  onUnlock: (reportUrl: string) => void;
};

export function UserResearchGate({ scanId, lang, riskTier, onUnlock }: UserResearchGateProps) {
  const t = copy[lang];
  const [step, setStep] = useState(1);
  const [q1, setQ1] = useState<Q1Id | "">("");
  const [q2, setQ2] = useState("");
  const [help, setHelp] = useState<Set<Q3Id>>(new Set());
  const [helpOther, setHelpOther] = useState("");
  const [q4, setQ4] = useState<Q4Id | "">("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Never show a validation message from a previous step; each step starts clean. */
  useEffect(() => {
    setErr(null);
  }, [step]);

  /** Fire user_research_started once per scan per session. */
  useEffect(() => {
    const key = `ss_user_research_started:${scanId || "anon"}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const props: Record<string, string> = { source: "post_scan_result", lang };
    if (riskTier) props.risk_tier = riskTier;
    logScanEvent("user_research_started", scanId ? { scan_id: scanId, props } : { props });
  }, [scanId, lang, riskTier]);

  const toggleHelp = (id: Q3Id) => {
    setHelp((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setErr(null);
        return next;
      }
      if (next.size >= MAX_HELP_OPTIONS) {
        setErr(t.errSelectAtMost);
        return prev;
      }
      next.add(id);
      setErr(null);
      return next;
    });
  };

  const goBack = () => {
    setErr(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    if (step === 1) {
      if (!q1) {
        setErr(t.errQ1);
        return;
      }
    } else if (step === 2) {
      const trimmed = q2.trim();
      if (trimmed.length < MIN_PROBLEM_LEN || trimmed.length > MAX_PROBLEM_LEN) {
        setErr(t.errQ2);
        return;
      }
    } else if (step === 3) {
      if (help.size < 1) {
        setErr(t.errQ3);
        return;
      }
      if (help.size > MAX_HELP_OPTIONS) {
        setErr(t.errSelectAtMost);
        return;
      }
    }
    setErr(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== TOTAL_STEPS) return;
    if (!q1) {
      setErr(t.errQ1);
      return;
    }
    const q2Trim = q2.trim();
    if (q2Trim.length < MIN_PROBLEM_LEN || q2Trim.length > MAX_PROBLEM_LEN) {
      setErr(t.errQ2);
      return;
    }
    if (help.size < 1) {
      setErr(t.errQ3);
      return;
    }
    if (help.size > MAX_HELP_OPTIONS) {
      setErr(t.errSelectAtMost);
      return;
    }
    if (!q4) {
      setErr(t.errQ4);
      return;
    }
    if (!scanId) {
      setErr(t.errSubmit);
      return;
    }

    setErr(null);
    setSubmitting(true);
    try {
      const helpArr = Array.from(help);
      const body: Record<string, unknown> = {
        scan_id: scanId,
        lang,
        q1_situation: q1,
        q2_problem_text: q2Trim,
        q3_help_options: helpArr,
        q4_price_range: q4,
      };
      const helpOtherTrim = helpOther.trim();
      if (help.has("other") && helpOtherTrim) body.q3_help_other = helpOtherTrim;

      const res = await fetch("/api/user-research/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        report_url?: string;
      };
      if (!res.ok || !data.ok || !data.report_url) {
        setErr(data.error || t.errSubmit);
        setSubmitting(false);
        return;
      }

      const completedProps: Record<string, string> = { source: "post_scan_result", lang };
      if (riskTier) completedProps.risk_tier = riskTier;
      logScanEvent("user_research_completed", {
        scan_id: scanId,
        props: completedProps,
      });
      onUnlock(data.report_url);
    } catch {
      setErr(t.errSubmit);
      setSubmitting(false);
    }
  };

  const progressPct = (step / TOTAL_STEPS) * 100;
  const progressLabel = t.progressLabel(step, TOTAL_STEPS);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-4">
        <p className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
          {t.questionsBadge}
        </p>
      </header>

      <form onSubmit={onSubmit}>
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{progressLabel}</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-amber-700 transition-[width] duration-200 ease-out"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-label={progressLabel}
            />
          </div>
        </div>

        <div className="min-h-[12rem]">
          {step === 1 ? (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">{t.q1Title}</legend>
              <div className="mt-2.5 space-y-2">
                {Q1_VALUES.map((v) => (
                  <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="q1"
                      value={v}
                      checked={q1 === v}
                      onChange={() => {
                        setQ1(v);
                        setErr(null);
                      }}
                      className="mt-0.5"
                    />
                    <span>{t.q1[v]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <div>
              <label htmlFor="problem" className="text-sm font-semibold text-slate-900">
                {t.q2Title}
              </label>
              <textarea
                id="problem"
                rows={4}
                value={q2}
                onChange={(e) => {
                  const v = e.target.value;
                  setQ2(v);
                  if (v.trim().length >= MIN_PROBLEM_LEN) setErr(null);
                }}
                placeholder={t.q2Placeholder}
                maxLength={MAX_PROBLEM_LEN}
                className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.q2Microcopy}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t.privacyNote}</p>
            </div>
          ) : null}

          {step === 3 ? (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">{t.q3Title}</legend>
              <p className="mt-1 text-xs text-slate-600">{t.q3Note}</p>
              <div className="mt-2.5 space-y-2">
                {Q3_VALUES.map((id) => {
                  const checked = help.has(id);
                  const reachedMax = !checked && help.size >= MAX_HELP_OPTIONS;
                  return (
                    <label
                      key={id}
                      className={
                        "flex cursor-pointer items-start gap-2 text-sm text-slate-800 " +
                        (reachedMax ? "opacity-60" : "")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleHelp(id)}
                        disabled={reachedMax}
                        className="mt-0.5"
                      />
                      <span>{t.q3[id]}</span>
                    </label>
                  );
                })}
              </div>
              {help.has("other") ? (
                <div className="mt-3">
                  <label htmlFor="helpOther" className="text-xs font-semibold text-slate-700">
                    {t.q3OtherLabel}
                  </label>
                  <input
                    id="helpOther"
                    type="text"
                    value={helpOther}
                    onChange={(e) => setHelpOther(e.target.value)}
                    maxLength={500}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  />
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {step === 4 ? (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">{t.q4Title}</legend>
              <div className="mt-2.5 space-y-2">
                {Q4_VALUES.map((v) => (
                  <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="q4"
                      value={v}
                      checked={q4 === v}
                      onChange={() => {
                        setQ4(v);
                        setErr(null);
                      }}
                      className="mt-0.5"
                    />
                    <span>{t.q4[v]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        {err ? <p className="mt-4 text-sm font-medium text-red-700">{err}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {t.back}
            </button>
          ) : null}
          <div className="min-w-[1rem] flex-1" aria-hidden />
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-900"
            >
              {t.next}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60 sm:min-w-[12rem]"
            >
              {submitting ? "\u2026" : t.submit}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default UserResearchGate;
