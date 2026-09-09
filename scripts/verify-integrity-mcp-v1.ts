import { createMcpHandler } from "@modelcontextprotocol/server";
import type { IntegrityClientIdentity } from "../lib/integrity/auth";
import { createIntegrityActorMcpServer } from "../lib/integrity/mcp-v1";

async function main() {
  const actor: IntegrityClientIdentity = {
    client_id: "11111111-1111-4111-8111-111111111111",
    principal_id: "test-principal",
    name: "mcp-test-actor",
    kind: "actor",
    scopes: ["preflight:write", "commit:write"],
    credential_id: "22222222-2222-4222-8222-222222222222",
  };

  const handler = createMcpHandler(
    () => createIntegrityActorMcpServer(actor),
    {
      legacy: "reject",
      responseMode: "json",
    }
  );

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {
          name: "scanscam-integrity-test",
          version: "1.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };

  const response = await handler.fetch(
    new Request("https://integrity.example/api/integrity/v1/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/list",
      },
      body: JSON.stringify(body),
    })
  );

  if (response.status !== 200) {
    throw new Error(`mcp_tools_list_http_${response.status}: ${await response.text()}`);
  }

  const result = await response.json() as any;
  const tools = result?.result?.tools;
  if (!Array.isArray(tools)) throw new Error("mcp_tools_list_missing");

  const names = tools.map((tool: any) => tool?.name).sort();
  const expected = [
    "integrity_commit",
    "integrity_preflight",
    "integrity_retry_challenge",
  ];

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`mcp_tool_surface_mismatch: ${JSON.stringify(names)}`);
  }

  if (names.some((name: string) => /observe|attest/i.test(name))) {
    throw new Error("mcp_actor_surface_breaks_independence");
  }

  const preflight = tools.find((tool: any) => tool?.name === "integrity_preflight");
  const required = preflight?.inputSchema?.required;
  if (!Array.isArray(required) || !required.includes("observation_id")) {
    throw new Error("mcp_preflight_observation_id_not_required");
  }

  let kindRejected = false;
  try {
    createIntegrityActorMcpServer({
      ...actor,
      kind: "observer",
      scopes: ["observe:write"],
    });
  } catch (error) {
    kindRejected = error instanceof Error &&
      error.message === "integrity_actor_kind_required";
  }
  if (!kindRejected) throw new Error("mcp_observer_was_allowed_as_actor");

  await handler.close();

  console.log(JSON.stringify({
    suite: "integrity-mcp-v1",
    protocol: "2026-07-28",
    passed: 5,
    failed: 0,
    tools: names,
    checks: [
      "modern MCP tools/list succeeds",
      "exact actor tool surface",
      "observe/attest excluded",
      "observation_id required",
      "observer identity rejected",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
