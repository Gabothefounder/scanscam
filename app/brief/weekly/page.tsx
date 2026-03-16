import BriefWeeklyContent from "./BriefWeeklyContent";

type PageProps = {
  searchParams?: Promise<{ lang?: string }> | { lang?: string };
};

export default async function BriefWeeklyPage({ searchParams }: PageProps) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const lang = params?.lang === "fr" ? "fr" : "en";
  return <BriefWeeklyContent lang={lang} />;
}
