import { DecisionReport } from "@/components/DecisionReport";
import { getProReportByToken } from "@/lib/proReports/getProReportByToken";
import { buildTelemetryFromIntel, extractAnalyzedDomainFromIntel } from "@/lib/proReports/intelReportModel";
import { buildReportAbsoluteUrl, resolveReportSiteOrigin } from "@/lib/proReports/resolveReportSiteOrigin";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

function firstQueryValue(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function resolveReportDisplayLang(
  urlLangRaw: string | undefined,
  scanLanguage: string | null | undefined
): "en" | "fr" {
  const u = (urlLangRaw ?? "").trim().toLowerCase();
  if (u === "fr") return "fr";
  if (u === "en") return "en";
  const s = String(scanLanguage ?? "").trim().toLowerCase();
  if (s === "fr") return "fr";
  if (s === "en") return "en";
  return "en";
}

export default async function SharedReportTokenPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const result = await getProReportByToken(token);

  if (result.status === "not_found") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Report not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This link may be incorrect, or the report may have been removed.
        </p>
      </main>
    );
  }

  if (result.status === "expired") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">This report link has expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Secure report links are valid for 21 days. Run a new scan to get updated guidance.
        </p>
      </main>
    );
  }

  const { access, scan } = result;
  const query = searchParams ? await searchParams : {};
  const urlLang = firstQueryValue(query.lang);
  const lang = resolveReportDisplayLang(urlLang, scan.language);
  const intel = scan.intel_features ?? {};
  const telemetry = buildTelemetryFromIntel(intel, scan.risk_tier);
  const analyzedDomain = extractAnalyzedDomainFromIntel(intel);
  const generatedAtMs = new Date(access.created_at).getTime();
  const reportExpiresAtMs = new Date(access.expires_at).getTime();
  const siteOrigin = await resolveReportSiteOrigin();
  const reportAbsoluteUrl = buildReportAbsoluteUrl(siteOrigin, token, lang);

  return (
    <DecisionReport
      lang={lang}
      scanId={scan.id}
      analyzedDomain={analyzedDomain}
      telemetry={telemetry}
      generatedAtMs={generatedAtMs}
      reportExpiresAtMs={reportExpiresAtMs}
      shareToken={access.access_token}
      reportAbsoluteUrl={reportAbsoluteUrl}
      partnerSlug={null}
      logProPreviewViewed={false}
    />
  );
}
