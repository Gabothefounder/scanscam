import { getServiceSupabase } from "./serviceSupabase";

export type ProReportAccessRow = {
  id: string;
  scan_id: string;
  access_token: string;
  created_at: string;
  expires_at: string;
  report_kind: string;
  report_snapshot: unknown | null;
};

export type ProReportScanRow = {
  id: string;
  risk_tier: string | null;
  intel_features: Record<string, unknown> | null;
  language: string | null;
  created_at: string;
};

export type GetProReportByTokenResult =
  | { status: "not_found" }
  | { status: "expired"; access: ProReportAccessRow }
  | { status: "ok"; access: ProReportAccessRow; scan: ProReportScanRow };

export async function getProReportByToken(token: string): Promise<GetProReportByTokenResult> {
  const trimmed = token?.trim() ?? "";
  if (!trimmed) return { status: "not_found" };

  const supabase = getServiceSupabase();
  const { data: accessRow, error } = await supabase
    .from("pro_report_access")
    .select("id, scan_id, access_token, created_at, expires_at, report_kind, report_snapshot")
    .eq("access_token", trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!accessRow) return { status: "not_found" };

  const access = accessRow as ProReportAccessRow;
  const expiresAt = new Date(access.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return { status: "expired", access };
  }

  const { data: scan, error: scanErr } = await supabase
    .from("scans")
    .select("id, risk_tier, intel_features, language, created_at")
    .eq("id", access.scan_id)
    .maybeSingle();

  if (scanErr) throw scanErr;
  if (!scan) return { status: "not_found" };

  return { status: "ok", access, scan: scan as ProReportScanRow };
}
