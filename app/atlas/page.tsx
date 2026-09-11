import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AtlasExperience from "./AtlasExperience";

export const metadata: Metadata = {
  title: "The Archive — ScanScam",
  description:
    "Explore how manipulation works. Once you see the pattern, you become harder to fool.",
};

export default async function AtlasPage({ searchParams }: { searchParams: Promise<{ lang?: string; pattern?: string }> }) {
  const params = await searchParams;
  const lang = params.lang === "fr" ? "fr" : "en";
  if (params.pattern) redirect(`/atlas/learn?${new URLSearchParams({ lang, pattern: params.pattern })}`);
  return <AtlasExperience initialLang={lang} />;
}
