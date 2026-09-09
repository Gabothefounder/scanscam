export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SignalRow = {
  scam_family: string | null;
  authority_type: string | null;
  primary_request: string | null;
  tactic_tags: string[] | null;
  emotion_vectors: string[] | null;
};

const allowedFamilies = new Set([
  "delivery_scam",
  "government_impersonation",
  "account_verification",
  "reward_claim",
  "romance_scam",
  "employment_scam",
]);

const safeValue = (value: string | null) =>
  value && !["unknown", "none", "unclassified"].includes(value) ? value : null;

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, counts: {} }, { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("atlas_scan_signals")
    .select("scam_family,authority_type,primary_request,tactic_tags,emotion_vectors")
    .limit(5000);

  if (error) return NextResponse.json({ ok: false, counts: {} }, { status: 503 });

  const counts: Record<string, number> = {};
  const add = (keyName: string | null) => {
    const normalized = safeValue(keyName);
    if (normalized) counts[normalized] = (counts[normalized] || 0) + 1;
  };

  for (const row of (data || []) as SignalRow[]) {
    if (row.scam_family && allowedFamilies.has(row.scam_family)) add(row.scam_family);
    add(row.authority_type);
    add(row.primary_request);
    for (const tag of row.tactic_tags || []) add(tag);
    for (const emotion of row.emotion_vectors || []) add(emotion);
  }

  return NextResponse.json({
    ok: true,
    sampleSize: data?.length || 0,
    counts,
    generatedAt: new Date().toISOString(),
  });
}
