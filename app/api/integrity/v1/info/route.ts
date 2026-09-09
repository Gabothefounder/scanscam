export const runtime = "nodejs";
export const dynamic = "force-static";

const INTEGRITY_INFO = {
  product: "ScanScam Integrity",
  status: "experimental",
  version: "0.1.1",
  purpose:
    "Independent preflight bolt-on for consequential autonomous-agent actions.",
  registry_name: "io.github.Gabothefounder/scanscam-integrity",
  mcp: {
    transport: "streamable-http",
    endpoint: "https://www.scanscam.ca/api/integrity/v1/mcp",
    authentication: "Bearer ScanScam actor credential",
    tools: [
      "integrity_preflight",
      "integrity_retry_challenge",
      "integrity_commit",
    ],
  },
  dispositions: ["ALLOW", "CHALLENGE", "APPROVAL_REQUIRED", "DENY"],
  checks: ["change", "mandate", "verification", "commitment", "values"],
  trust_model: {
    actor:
      "The external agent proposes/executes actions and cannot create independent evidence.",
    observation:
      "Preflight requires an observation ID created by an independent observer/runtime boundary.",
    verifier:
      "Challenges can be retried only after separately issued verifier attestations.",
    authorization:
      "ALLOW authorization is bound to the exact action and client, then settled by Commit.",
  },
  onboarding: {
    self_serve_credentials: false,
    contact: "hello@scanscam.ca",
    note:
      "The experimental release currently requires an issued actor credential and an independent observation setup.",
  },
  benchmark: {
    scope: "synthetic external-agent benchmark",
    decisions: "20/20",
    dangerous_false_allows: 0,
    exact_allow_commits: "8/8",
  },
  privacy: {
    usage_telemetry:
      "Stores connection/tool metadata only; tool arguments, transaction content, raw observations, and evidence are not copied into usage telemetry.",
  },
  limitations: [
    "Experimental; not a production assurance or compliance certification.",
    "The MCP tool is advisory unless the caller places it in an enforced execution path.",
    "No real-money production transaction benchmark has been claimed.",
    "No self-serve credential issuance yet.",
  ],
  human_docs: "https://www.scanscam.ca/integrity",
  demo: "https://www.scanscam.ca/integrity/demo",
  repository: "https://github.com/Gabothefounder/scanscam",
} as const;

export async function GET() {
  return Response.json(INTEGRITY_INFO, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
