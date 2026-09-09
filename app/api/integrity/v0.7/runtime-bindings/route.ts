import { createClient } from "@supabase/supabase-js";
import {
  authenticateIntegrityRequest,
  integrityAuthHttpStatus,
} from "@/lib/integrity/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function manager(request: Request) {
  try {
    return await authenticateIntegrityRequest(request, "clients:manage");
  } catch (error) {
    const message = error instanceof Error ? error.message : "integrity_auth_failed";
    throw Object.assign(new Error(message), { status: integrityAuthHttpStatus(message) });
  }
}

async function validateClients(input: {
  principal_id: string;
  observer_client_id: string;
  actor_client_id: string;
}) {
  if (input.observer_client_id === input.actor_client_id) {
    throw new Error("runtime_binding_requires_distinct_clients");
  }

  const { data, error } = await supabase
    .from("integrity_clients")
    .select("id,principal_id,name,kind,scopes,status,revoked_at")
    .eq("principal_id", input.principal_id)
    .in("id", [input.observer_client_id, input.actor_client_id]);

  if (error) throw new Error("runtime_binding_client_lookup_failed");
  if (!data || data.length !== 2) throw new Error("runtime_binding_client_not_found");

  const observer = data.find((row) => row.id === input.observer_client_id);
  const actor = data.find((row) => row.id === input.actor_client_id);

  if (
    !observer ||
    observer.status !== "active" ||
    observer.revoked_at ||
    !["observer", "hybrid"].includes(String(observer.kind)) ||
    !(observer.scopes ?? []).includes("observe:write")
  ) {
    throw new Error("runtime_binding_observer_invalid");
  }

  if (
    !actor ||
    actor.status !== "active" ||
    actor.revoked_at ||
    !["actor", "hybrid"].includes(String(actor.kind)) ||
    !(actor.scopes ?? []).includes("preflight:write") ||
    !(actor.scopes ?? []).includes("commit:write")
  ) {
    throw new Error("runtime_binding_actor_invalid");
  }

  return { observer, actor };
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  try {
    const identity = await manager(request);
    const { data, error } = await supabase
      .from("integrity_runtime_bindings")
      .select("id,protocol,external_agent_id,observer_client_id,actor_client_id,status,created_at,updated_at,revoked_at")
      .eq("principal_id", identity.principal_id)
      .order("created_at", { ascending: true });

    if (error) throw new Error("runtime_binding_lookup_failed");

    return Response.json({
      principal_id: identity.principal_id,
      bindings: data ?? [],
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.7",
      },
    });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({
      error: error instanceof Error ? error.message : "runtime_binding_failed",
    }, { status });
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let identity;
  try {
    identity = await manager(request);
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return Response.json({
      error: error instanceof Error ? error.message : "runtime_binding_failed",
    }, { status });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body?.action === "create") {
      const externalAgentId =
        typeof body.external_agent_id === "string"
          ? body.external_agent_id.trim().slice(0, 240)
          : "";
      const observerClientId =
        typeof body.observer_client_id === "string" ? body.observer_client_id : "";
      const actorClientId =
        typeof body.actor_client_id === "string" ? body.actor_client_id : "";

      if (
        !externalAgentId ||
        !UUID_RE.test(observerClientId) ||
        !UUID_RE.test(actorClientId)
      ) {
        return Response.json({ error: "runtime_binding_definition_invalid" }, { status: 400 });
      }

      await validateClients({
        principal_id: identity.principal_id,
        observer_client_id: observerClientId,
        actor_client_id: actorClientId,
      });

      const { data, error } = await supabase
        .from("integrity_runtime_bindings")
        .insert({
          principal_id: identity.principal_id,
          protocol: "acs",
          external_agent_id: externalAgentId,
          observer_client_id: observerClientId,
          actor_client_id: actorClientId,
          status: "active",
          metadata: {
            created_by_client_id: identity.client_id,
            acs_version: "0.1.0",
          },
        })
        .select("id,protocol,external_agent_id,observer_client_id,actor_client_id,status,created_at")
        .single();

      if (error || !data) {
        if (error?.code === "23505") {
          return Response.json({ error: "runtime_binding_already_exists" }, { status: 409 });
        }
        throw new Error("runtime_binding_create_failed");
      }

      return Response.json({ binding: data }, {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (body?.action === "revoke") {
      const bindingId = typeof body.binding_id === "string" ? body.binding_id : "";
      if (!UUID_RE.test(bindingId)) {
        return Response.json({ error: "runtime_binding_id_invalid" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("integrity_runtime_bindings")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bindingId)
        .eq("principal_id", identity.principal_id)
        .eq("status", "active")
        .select("id,status,revoked_at")
        .maybeSingle();

      if (error) throw new Error("runtime_binding_revoke_failed");
      if (!data) return Response.json({ error: "runtime_binding_not_found" }, { status: 404 });

      return Response.json({ binding: data });
    }

    return Response.json({
      error: "unknown_runtime_binding_action",
      actions: ["create", "revoke"],
    }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "runtime_binding_failed";
    const status =
      message.includes("not_found") ? 404 :
      message.includes("invalid") ? 409 :
      500;
    return Response.json({ error: message }, { status });
  }
}
