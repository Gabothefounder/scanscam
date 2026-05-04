"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

type Lang = "en" | "fr";

const DESIRED_HELP_IDS = [
  "shareable_report",
  "video",
  "step_by_step",
  "bank_workplace",
  "family_protection",
  "checklist_24_48",
  "other",
] as const;

type DesiredHelpId = (typeof DESIRED_HELP_IDS)[number];

const USER_SITUATION_VALUES = [
  "pre_action",
  "clicked_no_info",
  "entered_info",
  "paid_or_financial",
  "checking_for_someone_else",
] as const;

/** Report usefulness (Q4). Posted as `willingness_to_pay` must match API enum — see map below. */
const REPORT_USEFULNESS_VALUES = [
  "self_only",
  "family_friend",
  "workplace_it",
  "bank_support_provider",
  "personal_records",
  "other",
] as const;

type ReportUsefulnessId = (typeof REPORT_USEFULNESS_VALUES)[number];

/** API still validates legacy willingness tokens; temporarily map Q4 sharing/context IDs to legacy willingness_to_pay values. */
const USEFULNESS_TO_API_WILLINGNESS: Record<ReportUsefulnessId, string> = {
  self_only: "five_report",
  family_friend: "ten_twenty_fuller",
  workplace_it: "fifty_plus_evidence",
  bank_support_provider: "fifty_plus_evidence",
  personal_records: "ten_twenty_fuller",
  other: "free_only",
};

const TOTAL_STEPS = 4;

const copy: Record<
  Lang,
  {
    title: string;
    introStep1: string;
    questionsBadge: string;
    privacyNote: string;
    q1: string;
    q1o: Record<(typeof USER_SITUATION_VALUES)[number], string>;
    q2: string;
    q2ph: string;
    q3: string;
    q3o: Record<DesiredHelpId, string>;
    q4: string;
    q4o: Record<ReportUsefulnessId, string>;
    q4optional: string;
    submit: string;
    back: string;
    next: string;
    wizardBack: string;
    errQ1: string;
    errQ4: string;
    errRequired: string;
    errSelectOne: string;
    errSubmit: string;
    loading: string;
  }
> = {
  en: {
    title: "Unlock your beta report",
    introStep1:
      "This report is currently in beta. For now, you can unlock it for free by answering a few short questions.",
    questionsBadge: "4 short questions — about 30 seconds",
    privacyNote:
      "Please do not include sensitive personal information such as passwords, banking details, verification codes, or government ID numbers.",
    q1: "What happened with this link or message?",
    q1o: {
      pre_action: "I have not clicked or responded yet",
      clicked_no_info: "I clicked/opened it but did not enter anything",
      entered_info: "I entered information, a password, or a code",
      paid_or_financial: "I paid, transferred money, or shared financial details",
      checking_for_someone_else: "I’m checking this for someone else",
    },
    q2: "What worries you most about this scan? (optional)",
    q2ph:
      "Example: I’m worried it could steal my banking info, my mom might click it, I already entered my password, I need to show my boss…",
    q3: "What kind of help would be most useful after this scan? (optional, choose any)",
    q3o: {
      shareable_report: "A clear decision report I can share",
      video: "A short video explaining this type of scam",
      step_by_step: "Step-by-step guidance if I already clicked or entered information",
      bank_workplace: "Help preparing what to send to a bank, workplace, or support team",
      family_protection: "A way to protect a family member from similar scams",
      checklist_24_48: "A follow-up checklist for the next 24–48 hours",
      other: "Other",
    },
    q4: "Who would you want to use this report with?",
    q4o: {
      self_only: "Just for myself",
      family_friend: "A family member or friend",
      workplace_it: "My workplace or IT team",
      bank_support_provider: "A bank, support team, or service provider",
      personal_records: "I just want to keep it for my records",
      other: "Other",
    },
    q4optional: "Anything else about how you would use it? (optional)",
    submit: "Unlock beta report",
    back: "Back to report offer",
    next: "Next",
    wizardBack: "Back",
    errQ1: "Please choose an option for question 1.",
    errQ4: "Please choose an option for question 4.",
    errRequired: "Please answer this question.",
    errSelectOne: "Please select at least one option.",
    errSubmit: "Something went wrong. Please try again.",
    loading: "Loading…",
  },
  fr: {
    title: "Débloquer votre rapport bêta",
    introStep1:
      "Ce rapport est actuellement en bêta. Pour l’instant, vous pouvez le débloquer gratuitement en répondant à quelques questions rapides.",
    questionsBadge: "4 questions courtes — environ 30 secondes",
    privacyNote:
      "Veuillez ne pas inclure d’informations personnelles sensibles telles que mots de passe, données bancaires, codes de vérification ou numéros d’identité gouvernementaux.",
    q1: "Que s’est-il passé avec ce lien ou ce message?",
    q1o: {
      pre_action: "Je n’ai pas encore cliqué ni répondu",
      clicked_no_info: "J’ai cliqué ou ouvert, mais je n’ai rien saisi",
      entered_info: "J’ai saisi des informations, un mot de passe ou un code",
      paid_or_financial: "J’ai payé, transféré de l’argent ou partagé des données financières",
      checking_for_someone_else: "Je vérifie ceci pour quelqu’un d’autre",
    },
    q2: "Qu’est-ce qui vous inquiète le plus à propos de cette analyse? (facultatif)",
    q2ph:
      "Ex. : crainte pour mes données bancaires, ma mère pourrait cliquer, j’ai déjà entré mon mot de passe, je dois montrer cela à mon patron…",
    q3: "Quel type d’aide serait le plus utile après cette analyse? (facultatif, plusieurs choix)",
    q3o: {
      shareable_report: "Un rapport décisionnel clair à partager",
      video: "Une courte vidéo sur ce type d’arnaque",
      step_by_step: "Des étapes si j’ai déjà cliqué ou saisi des informations",
      bank_workplace: "De l’aide pour préparer un message à la banque, au travail ou au soutien",
      family_protection: "Un moyen de protéger un proche contre des arnaques similaires",
      checklist_24_48: "Une liste de suivi pour les 24–48 prochaines heures",
      other: "Autre",
    },
    q4: "Avec qui voudriez-vous utiliser ce rapport?",
    q4o: {
      self_only: "Juste pour moi",
      family_friend: "Un membre de la famille ou un ami",
      workplace_it: "Mon travail ou mon équipe TI",
      bank_support_provider: "Une banque, une équipe support ou un fournisseur de service",
      personal_records: "Je veux surtout le garder dans mes dossiers",
      other: "Autre",
    },
    q4optional: "Autre chose sur la façon dont vous l’utiliseriez? (optionnel)",
    submit: "Déverrouiller le rapport bêta",
    back: "Retour à l’offre de rapport",
    next: "Suivant",
    wizardBack: "Retour",
    errQ1: "Veuillez choisir une réponse à la question 1.",
    errQ4: "Veuillez choisir une réponse à la question 4.",
    errRequired: "Veuillez répondre à cette question.",
    errSelectOne: "Veuillez sélectionner au moins une option.",
    errSubmit: "Une erreur s’est produite. Veuillez réessayer.",
    loading: "Chargement…",
  },
};

function CheckoutInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const lang = sp.get("lang") === "fr" ? "fr" : "en";
  const t = copy[lang];
  const scanId = (sp.get("scan_id") ?? "").trim();

  const [q1, setQ1] = useState<string>("");
  const [q2, setQ2] = useState("");
  const [help, setHelp] = useState<Set<DesiredHelpId>>(new Set());
  const [helpOther, setHelpOther] = useState("");
  const [q4, setQ4] = useState<string>("");
  const [priceReason, setPriceReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const key = `ss_beta_unlock_started:${scanId || "anon"}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    logScanEvent("beta_unlock_started", scanId ? { scan_id: scanId, props: { flow: "beta" } } : { props: { flow: "beta" } });
  }, [scanId]);

  const backParams = new URLSearchParams();
  sp.forEach((value, key) => {
    backParams.set(key, value);
  });
  const backHref = backParams.toString() ? `/pro?${backParams.toString()}` : "/pro";

  const toggleHelp = (id: DesiredHelpId) => {
    setHelp((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const goWizardBack = () => {
    setErr(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    if (currentStep === 1) {
      if (!q1) {
        setErr(t.errQ1);
        return;
      }
    }
    if (currentStep === 2) {
      if (!q2.trim()) {
        setErr(t.errRequired);
        return;
      }
    }
    if (currentStep === 3) {
      if (!help.size) {
        setErr(t.errSelectOne);
        return;
      }
    }
    setErr(null);
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep !== TOTAL_STEPS) {
      return;
    }
    setErr(null);
    if (!q1) {
      setErr(t.errQ1);
      return;
    }
    if (!q4 || !(REPORT_USEFULNESS_VALUES as readonly string[]).includes(q4)) {
      setErr(t.errQ4);
      return;
    }
    if (!scanId) {
      setErr(t.errSubmit);
      return;
    }
    setSubmitting(true);
    try {
      const desired_help = Array.from(help);
      const usefulnessId = q4 as ReportUsefulnessId;
      const followUp = priceReason.trim();
      const price_reason_text = followUp
        ? `usefulness:${usefulnessId}\n\n${followUp}`
        : `usefulness:${usefulnessId}`;
      const body = {
        scan_id: scanId,
        beta_survey: {
          user_situation: q1,
          worry_text: q2.trim() || undefined,
          desired_help: desired_help.length ? desired_help : undefined,
          desired_help_other: help.has("other") ? helpOther.trim() || undefined : undefined,
          willingness_to_pay: USEFULNESS_TO_API_WILLINGNESS[usefulnessId],
          price_reason_text,
        },
      };
      const res = await fetch("/api/pro-report/beta-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; token?: string; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error || t.errSubmit);
        setSubmitting(false);
        return;
      }
      logScanEvent("beta_unlock_completed", {
        scan_id: scanId,
        props: { flow: "beta" },
      });
      const dest = data.url || (data.token ? `/r/${encodeURIComponent(data.token)}` : "/pro");
      router.replace(dest);
    } catch {
      setErr(t.errSubmit);
      setSubmitting(false);
    }
  };

  const progressLabel =
    lang === "fr" ? `Question ${currentStep} sur ${TOTAL_STEPS}` : `Question ${currentStep} of ${TOTAL_STEPS}`;
  const progressPct = (currentStep / TOTAL_STEPS) * 100;

  return (
    <main className="min-h-screen bg-slate-100/90 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {currentStep === 1 ? (
          <header className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{t.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.introStep1}</p>
            <p className="mt-4 inline-block rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
              {t.questionsBadge}
            </p>
          </header>
        ) : null}

        <form onSubmit={onSubmit}>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{progressLabel}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-amber-700 transition-[width] duration-200 ease-out"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={currentStep}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
                aria-label={progressLabel}
              />
            </div>
          </div>

          <div className="min-h-[12rem]">
            {currentStep === 1 ? (
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">{t.q1}</legend>
                <div className="mt-2 space-y-2">
                  {USER_SITUATION_VALUES.map((v) => (
                    <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name="q1"
                        value={v}
                        checked={q1 === v}
                        onChange={() => setQ1(v)}
                        className="mt-0.5"
                      />
                      <span>{t.q1o[v]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {currentStep === 2 ? (
              <div>
                <label htmlFor="worry" className="text-sm font-semibold text-slate-900">
                  {t.q2}
                </label>
                <textarea
                  id="worry"
                  rows={3}
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  placeholder={t.q2ph}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.privacyNote}</p>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">{t.q3}</legend>
                <div className="mt-2 space-y-2">
                  {DESIRED_HELP_IDS.map((id) => (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={help.has(id)}
                        onChange={() => toggleHelp(id)}
                        className="mt-0.5"
                      />
                      <span>{t.q3o[id]}</span>
                    </label>
                  ))}
                </div>
                {help.has("other") ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={helpOther}
                      onChange={(e) => setHelpOther(e.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
                      maxLength={500}
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.privacyNote}</p>
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {currentStep === 4 ? (
              <>
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-900">{t.q4}</legend>
                  <div className="mt-2 space-y-2">
                    {REPORT_USEFULNESS_VALUES.map((v) => (
                      <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                        <input
                          type="radio"
                          name="q4"
                          value={v}
                          checked={q4 === v}
                          onChange={() => setQ4(v)}
                          className="mt-0.5"
                        />
                        <span>{t.q4o[v]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6">
                  <label htmlFor="priceReason" className="text-sm font-semibold text-slate-900">
                    {t.q4optional}
                  </label>
                  <textarea
                    id="priceReason"
                    rows={2}
                    value={priceReason}
                    onChange={(e) => setPriceReason(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t.privacyNote}</p>
                </div>
              </>
            ) : null}
          </div>

          {err ? <p className="mt-4 text-sm font-medium text-red-700">{err}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goWizardBack}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                {t.wizardBack}
              </button>
            ) : null}
            <div className="min-w-[1rem] flex-1" aria-hidden />
            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-900"
              >
                {t.next}
              </button>
            ) : null}
            {currentStep === TOTAL_STEPS ? (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60 sm:min-w-[12rem]"
              >
                {submitting ? "…" : t.submit}
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center">
        <Link
          href={backHref}
          className="text-sm font-semibold text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
        >
          {t.back}
        </Link>
      </p>
    </main>
  );
}

export default function ProCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center p-6 text-gray-600">Loading…</div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
