import { McpServer } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { logEvent } from "@/lib/observability";
import * as z from "zod/v4";

export type IntegrityPublicMcpContext = {
  user_agent?: string | null;
  protocol_version?: string | null;
};

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

const needSchema = z.enum([
  "fraud_or_deception_check",
  "counterparty_risk",
  "policy_or_mandate_check",
  "payment_or_commitment_risk",
  "vendor_or_provenance_check",
  "supplier_matching",
  "identity_or_reputation_check",
  "contract_or_terms_risk",
  "human_verification",
  "other",
]);

const outcomeSchema = z.enum([
  "allow_or_block",
  "risk_signal",
  "independent_verification",
  "evidence_or_explanation",
  "recommendation",
  "other",
]);

const urgencySchema = z.enum(["now", "this_session", "later"]);
const willingnessSchema = z.enum(["yes", "maybe", "no"]);
const budgetSchema = z.enum([
  "under_0_05_usd",
  "0_05_to_0_25_usd",
  "0_25_to_1_usd",
  "1_to_5_usd",
  "over_5_usd",
  "unknown",
]);

function recordPublicToolUse(
  toolName: string,
  requestContext: IntegrityPublicMcpContext,
  context: Record<string, unknown>
) {
  after(() =>
    logEvent("integrity_mcp_public_tool_use", "info", "integrity_mcp", {
      tool_name: toolName,
      user_agent: requestContext.user_agent ?? null,
      protocol_version: requestContext.protocol_version ?? null,
      ...context,
    })
  );
}

export function createIntegrityPublicMcpServer(
  requestContext: IntegrityPublicMcpContext = {}
): McpServer {
  const server = new McpServer(
    {
      name: "scanscam-integrity",
      version: "1.1.0",
    },
    {
      capabilities: { tools: {} },
      instructions: [
        "ScanScam Integrity is an independent trust layer for agents.",
        "Discovery is public. Do not send transaction contents, secrets, personal data, counterparties, URLs, or credentials to the public tools.",
        "Use integrity_discover to see the compact service catalog.",
        "Use integrity_request_service to tell us, only in structured categories, what independent check you need and whether you would pay for it.",
        "Guardian execution tools require a ScanScam bearer credential and are exposed only to authenticated clients.",
      ].join(" "),
    }
  );

  server.registerTool(
    "integrity_discover",
    {
      title: "Discover ScanScam Integrity",
      description:
        "Public, no-auth storefront for agents. Returns what ScanScam Integrity can verify, the commercial model, and how to express demand. Do not send transaction data.",
      inputSchema: z.object({}),
      annotations: {
        title: "Discover ScanScam Integrity",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      recordPublicToolUse("integrity_discover", requestContext, {
        outcome: "ok",
        funnel_stage: "discovery",
      });

      return toolResult({
        service: "ScanScam Integrity",
        promise:
          "Independent checks before an agent makes a consequential commitment, payment, vendor, policy, or trust decision.",
        available_now: [
          {
            capability: "agent_action_guard",
            description:
              "Evaluate an independently observed proposed action against mandate, evidence, commitment, and deception controls.",
            access: "authenticated",
            tool: "integrity_preflight",
          },
        ],
        demand_catalog: [
          "fraud_or_deception_check",
          "counterparty_risk",
          "policy_or_mandate_check",
          "payment_or_commitment_risk",
          "vendor_or_provenance_check",
          "supplier_matching",
          "identity_or_reputation_check",
          "contract_or_terms_risk",
          "human_verification",
          "other",
        ],
        commercial_model: {
          model: "usage_based_microtransaction",
          status: "pilot",
          discovery_price_usd: 0,
          paid_check_price: "not_fixed_yet",
        },
        next_step:
          "Call integrity_request_service with structured categories only. This helps route your need and lets ScanScam learn which agent services are worth productizing.",
        privacy:
          "Public discovery and demand signals must not include transaction contents, counterparties, secrets, personal data, or URLs.",
      });
    }
  );

  server.registerTool(
    "integrity_request_service",
    {
      title: "Request an independent agent service",
      description:
        "Tell ScanScam what kind of independent service your agent needs, using categories only. This is a demand/fit signal, not a transaction submission.",
      inputSchema: z.object({
        need: needSchema.describe("Category of service needed. Never include transaction contents."),
        desired_outcome: outcomeSchema.describe("What result would make the service useful."),
        urgency: urgencySchema.optional().default("this_session"),
        willingness_to_pay: willingnessSchema.optional().default("maybe"),
        budget_per_check: budgetSchema.optional().default("unknown"),
        agent_name: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .optional()
          .describe("Optional agent/client product name only; no person names, IDs, secrets, or transaction data."),
      }),
      annotations: {
        title: "Request an independent agent service",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      need,
      desired_outcome,
      urgency,
      willingness_to_pay,
      budget_per_check,
      agent_name,
    }) => {
      recordPublicToolUse("integrity_request_service", requestContext, {
        outcome: "ok",
        funnel_stage: "service_request",
        need,
        desired_outcome,
        urgency,
        willingness_to_pay,
        budget_per_check,
        client_name: agent_name ?? null,
      });

      const availableNow = [
        "fraud_or_deception_check",
        "policy_or_mandate_check",
        "payment_or_commitment_risk",
      ].includes(need);

      return toolResult({
        status: availableNow ? "potential_fit" : "demand_logged",
        need,
        available_now: availableNow,
        commercial_model: "usage_based_microtransaction",
        paid_check_price: "pilot pricing not fixed yet",
        next_step: availableNow
          ? "For a live Guardian check, obtain a ScanScam Integrity credential and reconnect with Authorization: Bearer <credential>. Authenticated clients can call integrity_preflight."
          : "Demand recorded. This category is being evaluated for the public service catalog.",
        contact: "hello@scanscam.ca",
        privacy:
          "No transaction contents were requested by this public tool. Do not send transaction contents until a purpose-built protected service explicitly asks for them.",
      });
    }
  );

  return server;
}
