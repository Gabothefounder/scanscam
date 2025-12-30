export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { ReportPayloadSchema } from "@/lib/report/reportPayload";
import crypto from "crypto";

/* -------------------------------------------------
   Supabase client — SERVER ONLY
-------------------------------------------------- */

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/* -------------------------------------------------
   Rate limiting (in-memory, 24-hour window)
-------------------------------------------------- */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_REPORTS_PER_DAY = 5;

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkReportRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= MAX_REPORTS_PER_DAY) {
    return false;
  }

  entry.count += 1;
  return true;
}

/* -------------------------------------------------
   POST /api/report/submit
-------------------------------------------------- */

export async function POST(req: Request) {
  /* ---------- IP extraction ---------- */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    crypto.randomUUID();

  /* ---------- Rate limiting ---------- */
  if (!checkReportRateLimit(ip)) {
    return Response.json(
      {
        ok: false,
        error: "You've reached the daily reporting limit. Please try again later.",
      },
      { status: 429 }
    );
  }

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

