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

const WILLINGNESS_VALUES = [
  "free_only",
  "five_report",
  "ten_twenty_fuller",
  "fifty_plus_evidence",
  "hundred_plus_serious_help",
] as const;

const copy: Record<
  Lang,
  {
    title: string;
    intro1: string;
    intro2: string;
    questionsBadge: string;
    privacyNote: string;
    q1: string;
    q1o: Record<(typeof USER_SITUATION_VALUES)[number], string>;
    q2: string;
    q2ph: string;
    q3: string;
    q3o: Record<DesiredHelpId, string>;
    q4: string;
    q4o: Record<(typeof WILLINGNESS_VALUES)[number], string>;
    q4optional: string;
    submit: string;
    back: string;
    errQ1: string;
    errQ4: string;
    errSubmit: string;
    loading: string;
  }
> = {
  en: {
    title: "Unlock your report",
    intro1: "This report is currently in beta.",
    intro2:
      "Normally, this decision report costs $5. During beta, you can unlock it for free by answering four short questions.",
    questionsBadge: "4 short questions — about 30 seconds",
    privacyNote:
      "Please do not include sensitive personal information such as passwords, banking details, verification codes, or government ID numbers.",
    q1: "Where are you right now with this link or message?",
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
    q4: "If this helped you avoid a mistake or know what to do next, what would feel fair to pay?",
    q4o: {
      free_only: "$0 — I would only use this if free",
      five_report: "$5 for a quick decision report",
      ten_twenty_fuller: "$10–$20 for a fuller report and checklist",
      fifty_plus_evidence: "$50+ for help preparing something to send to a bank, workplace, or support team",
      hundred_plus_serious_help: "$100+ if I already lost money or needed serious help",
    },
    q4optional: "What would make it worth that price? (optional)",
    submit: "Unlock beta report",
    back: "Back to report offer",
    errQ1: "Please choose an option for question 1.",
    errQ4: "Please choose an option for question 4.",
    errSubmit: "Something went wrong. Please try again.",
    loading: "Loading…",
  },
  fr: {
    title: "Déverrouiller votre rapport",
    intro1: "Ce rapport est actuellement en version bêta.",
    intro2:
      "Normalement, ce rapport décisionnel coûte 5 $. Pendant la bêta, vous pouvez le déverrouiller gratuitement en répondant à quatre courtes questions.",
    questionsBadge: "4 courtes questions — environ 30 secondes",
    privacyNote:
      "Veuillez ne pas inclure d’informations personnelles sensibles telles que mots de passe, données bancaires, codes de vérification ou numéros d’identité gouvernementaux.",
    q1: "Où en êtes-vous avec ce lien ou ce message?",
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
    q4: "Si cela vous a aidé à éviter une erreur ou à savoir quoi faire, quel prix vous semblerait équitable?",
    q4o: {
      free_only: "0 $ — je n’utiliserais ceci que s’il est gratuit",
      five_report: "5 $ pour un rapport décisionnel rapide",
      ten_twenty_fuller: "10–20 $ pour un rapport plus complet et une liste de contrôle",
      fifty_plus_evidence: "50 $ et plus pour préparer un message à la banque, au travail ou au soutien",
      hundred_plus_serious_help: "100 $ et plus si j’ai déjà perdu de l’argent ou j’avais besoin d’aide sérieuse",
    },
    q4optional: "Qu’est-ce qui justifierait ce prix? (facultatif)",
    submit: "Déverrouiller le rapport bêta",
    back: "Retour à l’offre de rapport",
    errQ1: "Veuillez choisir une réponse à la question 1.",
    errQ4: "Veuillez choisir une réponse à la question 4.",
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!q1) {
      setErr(t.errQ1);
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
    setSubmitting(true);
    try {
      const desired_help = Array.from(help);
      const body = {
        scan_id: scanId,
        beta_survey: {
          user_situation: q1,
          worry_text: q2.trim() || undefined,
          desired_help: desired_help.length ? desired_help : undefined,
          desired_help_other: help.has("other") ? helpOther.trim() || undefined : undefined,
          willingness_to_pay: q4,
          price_reason_text: priceReason.trim() || undefined,
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

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-gray-900">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{t.intro1}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{t.intro2}</p>
      <p className="mt-4 inline-block rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
        {t.questionsBadge}
      </p>

      <form className="mt-8 space-y-8" onSubmit={onSubmit}>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">{t.q1}</legend>
          <div className="mt-2 space-y-2">
            {USER_SITUATION_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input type="radio" name="q1" value={v} checked={q1 === v} onChange={() => setQ1(v)} className="mt-0.5" />
                <span>{t.q1o[v]}</span>
              </label>
            ))}
          </div>
        </fieldset>

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

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">{t.q4}</legend>
          <div className="mt-2 space-y-2">
            {WILLINGNESS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input type="radio" name="q4" value={v} checked={q4 === v} onChange={() => setQ4(v)} className="mt-0.5" />
                <span>{t.q4o[v]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
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

        {err ? <p className="text-sm font-medium text-red-700">{err}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-amber-800 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60"
        >
          {submitting ? "…" : t.submit}
        </button>
      </form>

      <p className="mt-10">
        <Link
          href={backHref}
          className="text-sm font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
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
