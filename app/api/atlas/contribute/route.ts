export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

const Contribution = z.object({
  session_id: z.string().uuid(),
  scan_id: z.string().uuid().nullable(),
  lang: z.enum(["en", "fr"]),
  entry_mode: z.enum(["scan", "lived", "helping"]),
  selected_signals: z.record(z.string(), z.array(z.string().max(80)).max(12)),
  action_ids: z.array(z.string().max(80)).max(12),
  consent_version: z.literal("vigil_report_v1"),
});

export async function POST(req: Request) {
  const parsed = Contribution.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_report" }, { status: 422 });

  const payload = parsed.data;
  const { error } = await supabase.from("atlas_contributions").upsert({
    ...payload,
    source: "vigil_journey",
    consented_at: new Date().toISOString(),
    share_scope: "anonymous_pattern",
    private_text_included: false,
  }, { onConflict: "session_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ ok: false, error: "report_not_saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

