import { McpServer } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { logEvent } from "@/lib/observability";
import * as z from "zod/v4";
import type { IntegrityClientIdentity } from "./auth";
import { persistIntegrityChallenge, retryIntegrityChallenge } from "./challenge";
import {
  toIntegrityV1Commit,
  toIntegrityV1Preflight,
} from "./public-v1";
import {
  commitExecution,
  isExecutionCommitRequest,
  type ExecutionCommitRequest,
} from "./receipts";
import { runIntegrityV05 } from "./v05";

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function toolError(error: unknown) {
  const code = error instanceof Error ? error.message : "integrity_mcp_tool_failed";
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code } }) }],
    isError: true,
  };
}

const uuid = z.string().uuid();

function integrityToolErrorCode(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 120) : "integrity_mcp_tool_failed";
}

function recordIntegrityToolUse(
  identity: IntegrityClientIdentity,
  toolName: string,
  context: Record<string, unknown>
) {
  after(() =>
    logEvent("integrity_mcp_tool_use", "info", "integrity_mcp", {
      client_id: identity.client_id,
      client_name: identity.name.slice(0, 120),
      client_kind: identity.kind,
      credential_id: identity.credential_id,
      tool_name: toolName,
      ...context,
    })
  );
}

const commitSchema = z.object({
  authorization_id: z.string().min(1),
  authorization_token: z.string().min(20),
  executed_action: z.object({
    type: z.string().min(1),
    amount: z.number().finite().nonnegative().optional(),
    currency: z.string().optional(),
    counterparty_id: z.string().optional(),
    irreversible: z.boolean().optional(),
    creates_commitment: z.boolean().optional(),
    destination: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  outcome: z.enum(["succeeded", "failed"]),
  resulting_state: z.record(z.string(), z.any()).optional(),
  external_execution_id: z.string().optional(),
  executed_at: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export function createIntegrityActorMcpServer(
  identity: IntegrityClientIdentity
): McpServer {
  if (!["actor", "hybrid"].includes(identity.kind)) {
    throw new Error("integrity_actor_kind_required");
  }

  const server = new McpServer(
    {
      name: "scanscam-integrity",
      version: "1.0.0",
    },
    {
      capabilities: { tools: {} },
      instructions: [
        "This server is the actor-side ScanScam Integrity Guardian.",
        "Only use observation IDs created by an independent runtime observer.",
        "Never fabricate an observation ID or treat actor-provided claims as independent evidence.",
        "Call integrity_preflight before executing a consequential observed action.",
        "Execute only when disposition is ALLOW and preserve the exact authorized action.",
        "If disposition is CHALLENGE, obtain evidence from a separate verifier and retry the challenge.",
        "If disposition is APPROVAL_REQUIRED or DENY, do not execute.",
        "After an ALLOW action executes, settle the exact outcome with integrity_commit.",
      ].join(" "),
    }
  );

  server.registerTool(
    "integrity_preflight",
    {
      title: "Integrity preflight",
      description:
        "Evaluate an independently observed action against the principal mandate, trusted baseline, evidence, commitment rules, and deception controls. This tool does not create the observation.",
      inputSchema: z.object({
        observation_id: uuid.describe("Observation ID issued by an independent runtime observer."),
        attestation_ids: z.array(uuid).max(20).optional().describe(
          "Optional verifier-issued attestation IDs already available for this principal."
        ),
      }),
      annotations: {
        title: "Integrity preflight",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ observation_id, attestation_ids }) => {
      const startedAt = Date.now();
      try {
        const result = await runIntegrityV05(
          {
            observation_id,
            attestation_ids: attestation_ids ?? [],
          },
          identity
        );
        const challenge = await persistIntegrityChallenge(result, identity);
        const output = toIntegrityV1Preflight(result, challenge);
        recordIntegrityToolUse(identity, "integrity_preflight", {
          outcome: "ok",
          disposition: output.disposition,
          duration_ms: Date.now() - startedAt,
        });
        return toolResult({ ...output });
      } catch (error) {
        recordIntegrityToolUse(identity, "integrity_preflight", {
          outcome: "error",
          error_code: integrityToolErrorCode(error),
          duration_ms: Date.now() - startedAt,
        });
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "integrity_retry_challenge",
    {
      title: "Retry integrity challenge",
      description:
        "Retry an open Guardian challenge after independent verifier evidence has been issued. This tool cannot create attestations.",
      inputSchema: z.object({
        challenge_id: uuid,
        attestation_ids: z.array(uuid).min(1).max(20),
      }),
      annotations: {
        title: "Retry integrity challenge",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ challenge_id, attestation_ids }) => {
      const startedAt = Date.now();
      try {
        const retried = await retryIntegrityChallenge(
          challenge_id,
          attestation_ids,
          identity
        );
        const output = toIntegrityV1Preflight(retried.result, retried.challenge);
        recordIntegrityToolUse(identity, "integrity_retry_challenge", {
          outcome: "ok",
          disposition: output.disposition,
          duration_ms: Date.now() - startedAt,
        });
        return toolResult({ ...output });
      } catch (error) {
        recordIntegrityToolUse(identity, "integrity_retry_challenge", {
          outcome: "error",
          error_code: integrityToolErrorCode(error),
          duration_ms: Date.now() - startedAt,
        });
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "integrity_commit",
    {
      title: "Commit authorized execution",
      description:
        "Settle the observed outcome of the exact action authorized by Guardian. The one-time authorization token is client-bound and action-bound.",
      inputSchema: commitSchema,
      annotations: {
        title: "Commit authorized execution",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const startedAt = Date.now();
      try {
        if (!identity.scopes.includes("commit:write")) {
          throw new Error("integrity_scope_denied");
        }

        const request = input as unknown as ExecutionCommitRequest;
        if (!isExecutionCommitRequest(request)) {
          throw new Error("invalid_execution_commit_request");
        }

        const result = await commitExecution(request, identity);
        const output = toIntegrityV1Commit(result);
        recordIntegrityToolUse(identity, "integrity_commit", {
          outcome: result.ok ? "ok" : "rejected",
          duration_ms: Date.now() - startedAt,
        });
        return result.ok
          ? toolResult({ ...output })
          : {
              ...toolResult({ ...output }),
              isError: true,
            };
      } catch (error) {
        recordIntegrityToolUse(identity, "integrity_commit", {
          outcome: "error",
          error_code: integrityToolErrorCode(error),
          duration_ms: Date.now() - startedAt,
        });
        return toolError(error);
      }
    }
  );

  return server;
}
