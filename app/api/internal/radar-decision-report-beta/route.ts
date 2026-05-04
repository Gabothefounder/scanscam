import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/proReports/serviceSupabase";
import {
  buildDecisionReportBetaRadarPayload,
  DECISION_REPORT_BETA_RADAR_ROW_LIMIT,
  filterBetaUnlockRows,
  type ProReportAccessRadarRow,
  type ScanRadarJoinRow,
} from "@/lib/intel/decisionReportBetaRadarPayload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE_NAME = "internal_radar_auth";
const FETCH_FALLBACK = 800;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function requireInternalRadarAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (cookie?.value !== "1") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireInternalRadarAuth();
  if (denied) return denied;

  const supabase = getServiceSupabase();

  let accessRows: ProReportAccessRadarRow[] = [];

  const primary = await supabase
    .from("pro_report_access")
    .select("id, scan_id, created_at, expires_at, report_kind, report_snapshot")
    .contains("report_snapshot", { source: "beta_unlock" })
    .order("created_at", { ascending: false })
    .limit(DECISION_REPORT_BETA_RADAR_ROW_LIMIT);

  if (primary.error) {
    const fallback = await supabase
      .from("pro_report_access")
      .select("id, scan_id, created_at, expires_at, report_kind, report_snapshot")
      .order("created_at", { ascending: false })
      .limit(FETCH_FALLBACK);
    if (fallback.error) {
      console.error("[radar-decision-report-beta] pro_report_access", fallback.error);
      return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
    }
    accessRows = filterBetaUnlockRows((fallback.data ?? []) as ProReportAccessRadarRow[]).slice(
      0,
      DECISION_REPORT_BETA_RADAR_ROW_LIMIT
    );
  } else {
    accessRows = (primary.data ?? []) as ProReportAccessRadarRow[];
  }

  const betaSlice = filterBetaUnlockRows(accessRows).slice(0, DECISION_REPORT_BETA_RADAR_ROW_LIMIT);
  const scanIds = [...new Set(betaSlice.map((r) => r.scan_id).filter(Boolean))];

  const scansById = new Map<string, ScanRadarJoinRow>();
  for (const batch of chunks(scanIds, 100)) {
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from("scans")
      .select("id, risk_tier, language, created_at, intel_features")
      .in("id", batch);
    if (error) {
      console.error("[radar-decision-report-beta] scans", error);
      return NextResponse.json({ ok: false, error: "scan lookup failed" }, { status: 500 });
    }
    for (const row of data ?? []) {
      const s = row as ScanRadarJoinRow;
      if (s?.id) scansById.set(s.id, s);
    }
  }

  const payload = buildDecisionReportBetaRadarPayload(accessRows, scansById);
  return NextResponse.json(payload, { status: 200 });
}
