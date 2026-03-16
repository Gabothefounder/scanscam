import type { Metadata } from "next";
import BriefWeeklyContent from "./BriefWeeklyContent";

type PageProps = {
  searchParams?: Promise<{ lang?: string }> | { lang?: string };
};

export const metadata: Metadata = {
  title: "ScanScam Weekly Fraud Brief",
  description:
    "Fraud signals observed this week in Canada based on suspicious messages analyzed by ScanScam.",
  openGraph: {
    title: "ScanScam Weekly Fraud Brief",
    description: "Fraud signals observed this week in Canada.",
    url: "https://scanscam.ca/brief/weekly",
    siteName: "ScanScam",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScanScam Weekly Fraud Brief",
    description: "Fraud signals observed this week in Canada.",
  },
};

export default async function BriefWeeklyPage({ searchParams }: PageProps) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const lang = params?.lang === "fr" ? "fr" : "en";
  return <BriefWeeklyContent lang={lang} />;
}
