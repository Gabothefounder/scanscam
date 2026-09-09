import type { Metadata } from "next";
import AtlasExperience from "./AtlasExperience";

export const metadata: Metadata = {
  title: "The Archive — ScanScam",
  description:
    "Explore how manipulation works. Once you see the pattern, you become harder to fool.",
};

export default async function AtlasPage({ searchParams }: { searchParams: Promise<{ lang?: string; pattern?: string }> }) {
  const params = await searchParams;
  return <AtlasExperience initialLang={params.lang === "fr" ? "fr" : "en"} initialPattern={params.pattern || ""} />;
}
