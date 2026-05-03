import { randomBytes } from "crypto";
import { getServiceSupabase } from "./serviceSupabase";

const TWENTY_ONE_DAYS_MS = 21 * 24 * 60 * 60 * 1000;

function newAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateProReportAccessResult = {
  token: string;
  expiresAt: Date;
  id: string;
};

export type CreateProReportAccessOptions = {
  reportSnapshot?: Record<string, unknown> | null;
};

/**
 * Inserts a row into pro_report_access (server-only, service role).
 * Does not verify scan existence beyond FK on insert.
 */
export async function createProReportAccess(
  scanId: string,
  options?: CreateProReportAccessOptions | null
): Promise<CreateProReportAccessResult> {
  const supabase = getServiceSupabase();
  const access_token = newAccessToken();
  const expiresAt = new Date(Date.now() + TWENTY_ONE_DAYS_MS);
  const report_snapshot =
    options?.reportSnapshot && typeof options.reportSnapshot === "object"
      ? options.reportSnapshot
      : null;

  const { data, error } = await supabase
    .from("pro_report_access")
    .insert({
      scan_id: scanId,
      access_token,
      expires_at: expiresAt.toISOString(),
      report_kind: "decision_report",
      report_snapshot,
    })
    .select("id, expires_at")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("pro_report_access insert returned no id");

  return {
    token: access_token,
    expiresAt: new Date(String(data.expires_at)),
    id: String(data.id),
  };
}
