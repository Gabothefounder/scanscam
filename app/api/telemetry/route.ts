export const runtime = "nodejs";

import { after } from "next/server";
import { logEvent } from "@/lib/observability";
import {
  LEGACY_TELEMETRY_EVENT_MAP,
  TELEMETRY_BANNED_KEYS,
  TELEMETRY_EVENTS,
  TELEMETRY_PROP_KEYS,
} from "@/lib/telemetry/events";

/**
 * POST /api/telemetry
 * Strict, privacy-bounded product telemetry endpoint.
 */

const EVENT_SET = new Set<string>(TELEMETRY_EVENTS);
const PROP_SET = new Set<string>(TELEMETRY_PROP_KEYS);

function hasBannedKeys(obj: unknown, bannedKeys: readonly string[]): boolean {
  if (obj === null || obj === undefined || typeof obj !== "object") return false;
  if (Array.isArray(obj)) return obj.some((item) => hasBannedKeys(item, bannedKeys));

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (bannedKeys.includes(key)) return true;
    if (hasBannedKeys(value, bannedKeys)) return true;
  }
  return false;
}

function safeString(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function extractSafePayload(body: unknown): {
  event_type: string;
  session_id?: string;
  scan_id?: string;
  route?: string;
  props?: Record<string, unknown>;
} | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const eventType = input.event_type ?? input.event;
  if (typeof eventType !== "string" || !EVENT_SET.has(eventType)) return null;

  const safePayload: {
    event_type: string;
    session_id?: string;
    scan_id?: string;
    route?: string;
    props?: Record<string, unknown>;
  } = { event_type: eventType };

  const sessionId = safeString(input.session_id, 80);
  const scanId = safeString(input.scan_id, 80);
  const route = safeString(input.route, 200);
  if (sessionId) safePayload.session_id = sessionId;
  if (scanId && scanId.length > 10) safePayload.scan_id = scanId;
  if (route) safePayload.route = route;

  const rawProps = input.props;
  if (
    rawProps &&
    typeof rawProps === "object" &&
    !Array.isArray(rawProps) &&
    Object.getPrototypeOf(rawProps) === Object.prototype
  ) {
    const safeProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawProps as Record<string, unknown>)) {
      if (!PROP_SET.has(key)) continue;
      if (typeof value === "string") {
        safeProps[key] = value.slice(0, 160);
      } else if (
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        safeProps[key] = value;
      }
    }
    if (Object.keys(safeProps).length > 0) safePayload.props = safeProps;
  }

  return safePayload;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (hasBannedKeys(body, TELEMETRY_BANNED_KEYS)) {
    const input = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "banned_key",
      session_id: safeString(input.session_id, 80) ?? null,
      route: safeString(input.route, 200) ?? null,
    });
    return new Response(null, { status: 204 });
  }

  const safePayload = extractSafePayload(body);
  if (!safePayload) {
    const input = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
    const received = input.event_type ?? input.event;
    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "invalid_event",
      ...(typeof received === "string" ? { received_event: received.slice(0, 100) } : {}),
      ...(typeof input.session_id === "string" ? { session_id: input.session_id.slice(0, 80) } : {}),
      ...(typeof input.route === "string" ? { route: input.route.slice(0, 200) } : {}),
    });
    return new Response(null, { status: 204 });
  }

  const payloadString = JSON.stringify(safePayload);
  if (payloadString.length > 2000) {
    await logEvent("telemetry_rejected_payload", "warning", "telemetry_api", {
      reason: "too_large",
      session_id: safePayload.session_id ?? null,
      route: safePayload.route ?? null,
      size: payloadString.length,
    });
    return new Response(null, { status: 204 });
  }

  const canonicalEvent =
    LEGACY_TELEMETRY_EVENT_MAP[safePayload.event_type] ?? safePayload.event_type;
  const context: Record<string, unknown> = {
    build_id: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) ?? null,
    session_id: safePayload.session_id ?? null,
    scan_id: safePayload.scan_id ?? null,
    route: safePayload.route ?? null,
    props: safePayload.props ?? null,
  };

  const attrKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
  ] as const;
  const props = safePayload.props;
  if (props) {
    for (const key of attrKeys) {
      if (typeof props[key] === "string") context[key] = props[key];
    }
  }
  if (canonicalEvent !== safePayload.event_type) {
    context.original_event = safePayload.event_type;
  }

  after(() => logEvent(canonicalEvent, "info", "telemetry_api", context));
  return new Response(null, { status: 204 });
}
