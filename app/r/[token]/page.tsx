import { DecisionReport } from "@/components/DecisionReport";
import { getProReportByToken } from "@/lib/proReports/getProReportByToken";
import { buildTelemetryFromIntel, extractAnalyzedDomainFromIntel } from "@/lib/proReports/intelReportModel";
import { buildReportAbsoluteUrl, resolveReportSiteOrigin } from "@/lib/proReports/resolveReportSiteOrigin";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharedReportTokenPage({ params }: PageProps) {
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
  const lang = scan.language === "fr" ? "fr" : "en";
  const intel = scan.intel_features ?? {};
  const telemetry = buildTelemetryFromIntel(intel, scan.risk_tier);
  const analyzedDomain = extractAnalyzedDomainFromIntel(intel);
  const generatedAtMs = new Date(access.created_at).getTime();
  const reportExpiresAtMs = new Date(access.expires_at).getTime();
  const siteOrigin = await resolveReportSiteOrigin();
  const reportAbsoluteUrl = buildReportAbsoluteUrl(siteOrigin, token);

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
