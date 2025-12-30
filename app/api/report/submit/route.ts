export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { ReportPayloadSchema } from "@/lib/report/reportPayload";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   POST /api/report/submit
-------------------------------------------------- */

export async function POST(req: Request) {
  /* ---------- Parse JSON body ---------- */
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  /* ---------- Validate payload ---------- */
  const validationResult = ReportPayloadSchema.safeParse(body);

  if (!validationResult.success) {
    return Response.json(
      { ok: false, error: "Invalid payload" },
      { status: 422 }
    );
  }

  const payload = validationResult.data;

  /* ---------- Insert report ---------- */
  const { error } = await supabase.from("reports").insert(payload);

  if (error) {
    return Response.json(
      { ok: false, error: "Database insert failed" },
      { status: 500 }
    );
  }

  /* ---------- Success ---------- */
  return Response.json({ ok: true });
}

