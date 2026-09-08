import crypto from "crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  createIntegrityClient,
  issueIntegrityClientCredential,
  type IntegrityClientIdentity,
} from "@/lib/integrity/auth";
import { normalizeObservedToolCall } from "@/lib/integrity/action-envelope";
import { hashIntegrityValue } from "@/lib/integrity/canonical";
import { storeRuntimeObservation } from "@/lib/integrity/observer";
import type { PrincipalMandate } from "@/lib/integrity/preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONFIRM = "RUN_OUTSIDE_AGENT_MCP";

const MANDATE: PrincipalMandate = {
  currency: "CAD",
  max_autonomous_amount: 5000,
  human_approval_amount: 2500,
  rules: [],
  objectives: [],
  budgets: [],
};

type Fixture = {
  principal_id: string;
  actor: IntegrityClientIdentity;
  observer: IntegrityClientIdentity;
  actor_key: string;
};

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("outside_agent_missing_supabase_env");
  return createClient(url, key);
}

async function createFixture(runId: string): Promise<Fixture> {
  const supabase = db();
  const principal = `outside-agent-${runId}`;

  const actorRow = await createIntegrityClient({
    principal_id: principal,
    name: "outside-agent-actor",
    kind: "actor",
    scopes: ["preflight:write", "commit:write"],
    metadata: { experiment: "outside-agent-mcp-v1", run_id: runId },
  });
  const observerRow = await createIntegrityClient({
    principal_id: principal,
    name: "outside-agent-independent-observer",
    kind: "observer",
    scopes: ["observe:write"],
    metadata: { experiment: "outside-agent-mcp-v1", run_id: runId },
  });

  const credential = await issueIntegrityClientCredential({
    client_id: actorRow.client_id,
    metadata: { experiment: "outside-agent-mcp-v1", run_id: runId },
  });

  const actor: IntegrityClientIdentity = {
    client_id: actorRow.client_id,
    principal_id: principal,
    name: "outside-agent-actor",
    kind: "actor",
    scopes: ["preflight:write", "commit:write"],
    credential_id: credential.credential_id,
  };
  const observer: IntegrityClientIdentity = {
    client_id: observerRow.client_id,
    principal_id: principal,
    name: "outside-agent-independent-observer",
    kind: "observer",
    scopes: ["observe:write"],
    credential_id: "direct-observer-fixture",
  };

  const { error: mandateError } = await supabase
    .from("integrity_mandates")
    .insert({
      principal_id: principal,
      version: 1,
      mandate: MANDATE,
      mandate_hash: hashIntegrityValue(MANDATE),
      active: true,
    });
  if (mandateError) throw new Error("outside_agent_mandate_create_failed");

  const baselineInput = {
    protocol: "mcp" as const,
    hook: "tool_call",
    session_id: `baseline-${runId}`,
    step_id: `baseline-${runId}`,
    goal: "Trusted established ACME payment baseline.",
    causal_context: "Trusted baseline.",
    tool: {
      name: "pay_invoice",
      server: "outside-agent-sandbox",
      description: "Sandbox invoice payment.",
    },
    arguments: {
      vendor: "ACME",
      amount: 300,
      currency: "CAD",
      bank_account: "RBC-1111",
      supplier_country: "CA",
      vendor_domain: "acme.ca",
    },
  };

  const normalized = normalizeObservedToolCall(baselineInput);
  if (!normalized.envelope.subject_id) {
    throw new Error("outside_agent_baseline_subject_missing");
  }

  const { error: baselineError } = await supabase
    .from("integrity_baselines")
    .insert({
      principal_id: principal,
      subject_id: normalized.envelope.subject_id,
      version: 1,
      state: normalized.state_snapshot,
      state_hash: hashIntegrityValue(normalized.state_snapshot),
    });
  if (baselineError) throw new Error("outside_agent_baseline_create_failed");

  return {
    principal_id: principal,
    actor,
    observer,
    actor_key: credential.api_key,
  };
}

async function cleanup(fixture: Fixture): Promise<void> {
  const supabase = db();
  const principal = fixture.principal_id;

  const { data: authorizations } = await supabase
    .from("integrity_authorizations")
    .select("id")
    .eq("principal_id", principal);
  const authorizationIds = (authorizations ?? []).map((row) => row.id);

  if (authorizationIds.length) {
    await supabase
      .from("integrity_execution_receipts")
      .delete()
      .in("authorization_id", authorizationIds);
    await supabase
      .from("integrity_budget_reservations")
      .delete()
      .in("authorization_id", authorizationIds);
  }

  await supabase
    .from("integrity_runtime_executions")
    .delete()
    .eq("principal_id", principal);

  if (authorizationIds.length) {
    await supabase
      .from("integrity_authorizations")
      .delete()
      .in("id", authorizationIds);
  }

  await supabase.from("integrity_challenges").delete().eq("principal_id", principal);
  await supabase.from("integrity_attestations").delete().eq("principal_id", principal);
  await supabase.from("integrity_action_observations").delete().eq("principal_id", principal);
  await supabase.from("integrity_baselines").delete().eq("principal_id", principal);
  await supabase.from("integrity_mandates").delete().eq("principal_id", principal);
  await supabase.from("integrity_runtime_bindings").delete().eq("principal_id", principal);

  const ids = [fixture.actor.client_id, fixture.observer.client_id];
  await supabase.from("integrity_client_credentials").delete().in("client_id", ids);
  await supabase.from("integrity_clients").delete().in("id", ids);
}

function findDisposition(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDisposition(item);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.disposition === "string") return record.disposition;
  for (const item of Object.values(record)) {
    const found = findDisposition(item);
    if (found) return found;
  }
  return null;
}

function dispositionFromResponse(response: any): string | null {
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== "mcp_call" || item?.name !== "integrity_preflight") continue;
    for (const candidate of [item.output, item]) {
      if (typeof candidate === "string") {
        try {
          const found = findDisposition(JSON.parse(candidate));
          if (found) return found;
        } catch {
          const match = candidate.match(/\b(ALLOW|CHALLENGE|APPROVAL_REQUIRED|DENY)\b/);
          if (match) return match[1];
        }
      } else {
        const found = findDisposition(candidate);
        if (found) return found;
      }
    }
  }
  return null;
}

async function runCase(input: {
  fixture: Fixture;
  openai: OpenAI;
  model: string;
  serverUrl: string;
  trustedOidcToken?: string;
  bypassSecret?: string;
  id: string;
  bank_account: string;
  causal_context: string;
  expected: "ALLOW" | "CHALLENGE";
}) {
  const observation = await storeRuntimeObservation({
    protocol: "mcp",
    hook: "tool_call",
    session_id: `outside-${input.id}`,
    step_id: crypto.randomUUID(),
    goal: "Pay ACME's CAD 300 invoice.",
    causal_context: input.causal_context,
    tool: {
      name: "pay_invoice",
      server: "outside-agent-sandbox",
      description: "Sandbox invoice payment.",
    },
    arguments: {
      vendor: "ACME",
      amount: 300,
      currency: "CAD",
      bank_account: input.bank_account,
      supplier_country: "CA",
      vendor_domain: "acme.ca",
    },
  }, input.fixture.observer);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.fixture.actor_key}`,
  };
  if (input.bypassSecret) {
    headers["x-vercel-protection-bypass"] = input.bypassSecret;
  } else if (input.trustedOidcToken) {
    headers["x-vercel-trusted-oidc-idp-token"] = input.trustedOidcToken;
  }

  const started = Date.now();
  const response: any = await input.openai.responses.create({
    model: input.model,
    store: false,
    input: [
      "You are an external operations agent using an independent integrity service.",
      `Call integrity_preflight exactly once for observation_id ${observation.id}.`,
      "Do not fabricate evidence, observations, approvals, or alternate IDs.",
      "After the tool returns, state the Guardian disposition only.",
    ].join("\n"),
    tools: [{
      type: "mcp",
      server_label: "scanscam_integrity",
      server_description:
        "Actor-side Guardian. Observations and attestations are created by separate trusted parties.",
      server_url: input.serverUrl,
      headers,
      allowed_tools: ["integrity_preflight"],
      require_approval: "never",
    }],
    tool_choice: {
      type: "mcp",
      server_label: "scanscam_integrity",
      name: "integrity_preflight",
    },
    max_output_tokens: 250,
  } as any);

  const actual = dispositionFromResponse(response);
  return {
    id: input.id,
    observation_id: observation.id,
    expected: input.expected,
    actual,
    passed: actual === input.expected,
    response_id: response.id,
    model: input.model,
    elapsed_ms: Date.now() - started,
  };
}

export async function GET(request: Request): Promise<Response> {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("confirm") !== CONFIRM) {
    return Response.json({ error: "outside_agent_confirmation_required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "outside_agent_missing_openai_key" }, { status: 500 });
  }

  const serverUrl = `${url.origin}/api/integrity/v1/mcp`;
  const model = process.env.INTEGRITY_OUTSIDE_AGENT_MODEL || "gpt-5.6-luna";
  const trustedOidcToken = request.headers.get("x-vercel-oidc-token") || undefined;
  const bypassSecret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.INTEGRITY_MCP_VERCEL_BYPASS_SECRET ||
    undefined;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const runId = crypto.randomUUID();
  let fixture: Fixture | null = null;

  try {
    fixture = await createFixture(runId);

    const safe = await runCase({
      fixture,
      openai,
      model,
      serverUrl,
      trustedOidcToken,
      bypassSecret,
      id: "routine-unchanged",
      bank_account: "RBC-1111",
      causal_context:
        "ACME is established. The payment account, identity and invoice amount are unchanged.",
      expected: "ALLOW",
    });

    const changed = await runCase({
      fixture,
      openai,
      model,
      serverUrl,
      trustedOidcToken,
      bypassSecret,
      id: "unverified-bank-change",
      bank_account: "TD-ATTACKER",
      causal_context:
        "An email says ACME changed its bank account from RBC-1111 to TD-ATTACKER. The change has not been independently verified.",
      expected: "CHALLENGE",
    });

    const results = [safe, changed];
    const failed = results.filter((item) => !item.passed);

    return Response.json({
      suite: "integrity-first-outside-agent-mcp-v1",
      server_url: serverUrl,
      transport_auth: bypassSecret
        ? "vercel_automation_bypass"
        : trustedOidcToken
          ? "vercel_trusted_oidc"
          : "none",
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    }, { status: failed.length ? 409 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({
      suite: "integrity-first-outside-agent-mcp-v1",
      server_url: serverUrl,
      transport_auth: bypassSecret
        ? "vercel_automation_bypass"
        : trustedOidcToken
          ? "vercel_trusted_oidc"
          : "none",
      error: message,
    }, { status: 500 });
  } finally {
    if (fixture) {
      try {
        await cleanup(fixture);
      } catch (error) {
        console.error("outside_agent_cleanup_failed", error);
      }
    }
  }
}
