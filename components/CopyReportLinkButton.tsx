"use client";

import { useCallback, useState } from "react";

const labels = {
  en: { copy: "Copy secure link", copied: "Copied" },
  fr: { copy: "Copier le lien sécurisé", copied: "Copié" },
} as const;

type Lang = "en" | "fr";

type Props = {
  reportUrl: string;
  lang: Lang;
  className?: string;
};

export function CopyReportLinkButton({ reportUrl, lang, className }: Props) {
  const t = labels[lang];
  const [state, setState] = useState<"idle" | "copied">("idle");

  const onCopy = useCallback(async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  }, [reportUrl]);

  const label = state === "copied" ? t.copied : t.copy;

  return (
    <button
      type="button"
      onClick={onCopy}
      className={
        className ??
        "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      }
      aria-live="polite"
    >
      {label}
    </button>
  );
}
