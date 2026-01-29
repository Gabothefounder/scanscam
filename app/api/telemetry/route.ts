export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { logEvent } from "@/lib/observability";

/**
 * POST /api/telemetry
 * Client-side telemetry endpoint for scan events.
 * Fire-and-forget logging to observability system.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, ...data } = body;

    // Log to observability system (fire-and-forget)
    logEvent(event, "info", "scan_telemetry", data).catch(() => {
      // Silent failure
    });

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
