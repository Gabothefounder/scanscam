import type { Metadata } from "next";
import ArchiveExplorer from "../ArchiveExplorer";
export const metadata: Metadata = {
  title: "How scams work — ScanScam",
  description: "Follow the contact, request, pressure, end goal and response. A short guide to recognising manipulation, one step at a time.",
};
export default async function LearnPage({ searchParams }: { searchParams: Promise<{ lang?: string; pattern?: string }> }) {
  const params = await searchParams;
  return <ArchiveExplorer initialLang={params.lang === "fr" ? "fr" : "en"} initialPattern={params.pattern || ""} />;
}
