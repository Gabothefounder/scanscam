import type { Primitive, ProposedAction } from "./preflight";
import { hashIntegrityValue } from "./canonical";

export type ActionEffect =
  | "financial_transfer"
  | "purchase"
  | "contract_acceptance"
  | "access_grant"
  | "publication"
  | "data_disclosure"
  | "destructive"
  | "external_communication"
  | "unknown";

export type ActionProtocol = "acs" | "mcp" | "a2a" | "http" | "native" | "other";

export type ActionEnvelope = {
  version: "0.5";
  effect: ActionEffect;
  verb: string;
  subject_id?: string;
  goal?: string;
  tool: {
    protocol: ActionProtocol;
    hook: string;
    server?: string;
    name: string;
    description?: string;
    schema_hash?: string;
  };
  counterparty?: {
    id?: string;
    domain?: string;
    country?: string;
  };
  money?: {
    amount: number;
    currency?: string;
  };
  destination?: {
    kind: string;
    value_hash: string;
  };
  resource?: {
    type?: string;
    id?: string;
  };
  permissions?: string[];
  policy_facts?: Record<string, Primitive>;
  consequences: {
    irreversible: boolean;
    creates_commitment: boolean;
  };
  arguments_hash: string;
};

export type ObservedToolCallInput = {
  protocol: ActionProtocol;
  hook?: string;
  session_id?: string;
  step_id?: string;
  goal?: string;
  causal_context?: string;
  tool: {
    name: string;
    server?: string;
    description?: string;
    schema_hash?: string;
  };
  arguments?: Record<string, Primitive>;
};

const AMOUNT_KEYS = ["amount", "total", "price", "cost", "value", "payment_amount"];
const CURRENCY_KEYS = ["currency", "currency_code"];
const COUNTERPARTY_KEYS = [
  "counterparty_id", "vendor_id", "supplier_id", "merchant_id", "recipient_id",
  "payee_id", "vendor", "supplier", "merchant", "recipient", "payee",
];
const DESTINATION_KEYS = [
  "bank_account", "account_number", "iban", "routing", "routing_number",
  "wallet", "wallet_address", "payment_destination", "beneficiary_account",
  "destination", "recipient_account",
];
const DOMAIN_KEYS = ["domain", "email_domain", "merchant_domain", "vendor_domain"];
const COUNTRY_KEYS = ["country", "country_code", "supplier_country", "merchant_country"];
const RESOURCE_KEYS = ["resource_id", "file_id", "document_id", "contract_id", "order_id", "workspace_id"];
const PERMISSION_KEYS = ["permission", "permissions", "role", "scope", "scopes", "access"];

function scalar(value: Primitive | undefined): string | number | boolean | null | undefined {
  return value === null || ["string", "number", "boolean"].includes(typeof value)
    ? (value as string | number | boolean | null | undefined)
    : undefined;
}

function findByKeys(
  source: Record<string, Primitive> | undefined,
  wanted: string[]
): Primitive | undefined {
  if (!source) return undefined;
  const wantedSet = new Set(wanted.map((key) => key.toLowerCase()));
  const queue: Primitive[] = [source];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      for (const value of current.slice(0, 50)) queue.push(value);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (wantedSet.has(key.toLowerCase())) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return undefined;
}

function stringValue(source: Record<string, Primitive> | undefined, keys: string[]): string | undefined {
  const value = scalar(findByKeys(source, keys));
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function numberValue(source: Record<string, Primitive> | undefined, keys: string[]): number | undefined {
  const value = scalar(findByKeys(source, keys));
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function listValue(source: Record<string, Primitive> | undefined, keys: string[]): string[] {
  const value = findByKeys(source, keys);
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  const single = scalar(value);
  return typeof single === "string" && single.trim() ? [single.trim()] : [];
}

const SECRET_KEY_RE = /(password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key|session[_-]?key)/i;
const SENSITIVE_VALUE_KEY_RE = /(bank[_-]?account|account[_-]?number|iban|routing|wallet|payment[_-]?destination|recipient[_-]?account)/i;

function sanitizePolicyFacts(
  value: Primitive,
  key = "",
  depth = 0
): Primitive | undefined {
  if (SECRET_KEY_RE.test(key)) return undefined;
  if (depth > 4) return undefined;

  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().slice(0, 240);
    if (SENSITIVE_VALUE_KEY_RE.test(key)) return `sha256:${hashIntegrityValue(trimmed)}`;
    return trimmed;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, 20)
      .map((item) => sanitizePolicyFacts(item, key, depth + 1))
      .filter((item): item is Primitive => item !== undefined);
    return items;
  }

  const output: Record<string, Primitive> = {};
  for (const [childKey, childValue] of Object.entries(value).slice(0, 64)) {
    const clean = sanitizePolicyFacts(childValue, childKey, depth + 1);
    if (clean !== undefined) output[childKey] = clean;
  }
  return output;
}

function inferEffect(toolName: string, args: Record<string, Primitive> | undefined): ActionEffect {
  const name = toolName.toLowerCase();
  const amount = numberValue(args, AMOUNT_KEYS);
  const destination = stringValue(args, DESTINATION_KEYS);

  if (
    /(^|[_-])(pay|payment|transfer|wire|remit|payout)([_-]|$)/i.test(name) ||
    /send.*(money|fund)|settle.*invoice/i.test(name) ||
    (amount !== undefined && !!destination)
  ) return "financial_transfer";

  if (/(purchase|checkout|place[_-]?order|buy|book)/i.test(name)) return "purchase";
  if (/(sign|accept).*(contract|terms|agreement)|contract.*(sign|accept)/i.test(name)) {
    return "contract_acceptance";
  }
  if (/(grant|permission|role|access|invite|add[_-]?member)/i.test(name)) return "access_grant";
  if (/(delete|destroy|drop|wipe|terminate)/i.test(name)) return "destructive";
  if (/(publish|post|release[_-]?public|make[_-]?public)/i.test(name)) return "publication";
  if (/(upload|share|export|send).*?(file|data|document|record)/i.test(name)) return "data_disclosure";
  if (/(send[_-]?(email|message)|notify|email|message)/i.test(name)) return "external_communication";

  return "unknown";
}

function canonicalSubject(input: {
  counterparty?: string;
  domain?: string;
  resource?: string;
  toolServer?: string;
}): string | undefined {
  if (input.counterparty) return `counterparty:${input.counterparty.trim().toLowerCase()}`;
  if (input.domain) return `domain:${input.domain.trim().toLowerCase()}`;
  if (input.resource) return `resource:${input.resource.trim().toLowerCase()}`;
  if (input.toolServer) return `tool:${input.toolServer.trim().toLowerCase()}`;
  return undefined;
}

export function normalizeObservedToolCall(input: ObservedToolCallInput): {
  envelope: ActionEnvelope;
  state_snapshot: Record<string, Primitive>;
} {
  const args = input.arguments ?? {};
  const toolName = input.tool.name.trim();
  if (!toolName) throw new Error("observed_tool_name_required");

  const amount = numberValue(args, AMOUNT_KEYS);
  const currency = stringValue(args, CURRENCY_KEYS)?.toUpperCase();
  const counterparty = stringValue(args, COUNTERPARTY_KEYS);
  const destination = stringValue(args, DESTINATION_KEYS);
  const domain = stringValue(args, DOMAIN_KEYS)?.toLowerCase();
  const country = stringValue(args, COUNTRY_KEYS)?.toUpperCase();
  const resourceId = stringValue(args, RESOURCE_KEYS);
  const permissions = listValue(args, PERMISSION_KEYS);
  const effect = inferEffect(toolName, args);

  const subjectId = canonicalSubject({
    counterparty,
    domain,
    resource: resourceId,
    toolServer: input.tool.server,
  });

  const irreversible = effect === "financial_transfer" || effect === "destructive";
  const createsCommitment =
    irreversible ||
    effect === "purchase" ||
    effect === "contract_acceptance" ||
    effect === "access_grant";

  const envelope: ActionEnvelope = {
    version: "0.5",
    effect,
    verb: toolName,
    subject_id: subjectId,
    goal: input.goal?.trim().slice(0, 1200) || undefined,
    tool: {
      protocol: input.protocol,
      hook: input.hook?.trim() || "toolCallRequest",
      server: input.tool.server?.trim().slice(0, 500) || undefined,
      name: toolName.slice(0, 240),
      description: input.tool.description?.trim().slice(0, 1000) || undefined,
      schema_hash: input.tool.schema_hash?.trim().slice(0, 160) || undefined,
    },
    counterparty:
      counterparty || domain || country
        ? {
            id: counterparty?.slice(0, 240),
            domain: domain?.slice(0, 240),
            country: country?.slice(0, 16),
          }
        : undefined,
    money:
      amount !== undefined
        ? {
            amount,
            currency,
          }
        : undefined,
    destination: destination
      ? {
          kind: "opaque_destination",
          value_hash: hashIntegrityValue(destination),
        }
      : undefined,
    resource: resourceId
      ? {
          id: resourceId.slice(0, 240),
        }
      : undefined,
    permissions: permissions.length ? permissions : undefined,
    policy_facts: sanitizePolicyFacts(args as unknown as Primitive) as Record<string, Primitive>,
    consequences: {
      irreversible,
      creates_commitment: createsCommitment,
    },
    arguments_hash: hashIntegrityValue(args),
  };

  const state_snapshot: Record<string, Primitive> = {
    subject: {
      id: subjectId ?? null,
      destination_hash: envelope.destination?.value_hash ?? null,
      domain: envelope.counterparty?.domain ?? null,
      country: envelope.counterparty?.country ?? null,
      tool_server: envelope.tool.server ?? null,
      permissions: envelope.permissions ?? [],
    },
  };

  return { envelope, state_snapshot };
}

export function actionEnvelopeToProposedAction(envelope: ActionEnvelope): ProposedAction {
  const typeByEffect: Record<ActionEffect, string> = {
    financial_transfer: "transfer_funds",
    purchase: "place_order",
    contract_acceptance: "sign_contract",
    access_grant: "grant_access",
    publication: "publish",
    data_disclosure: "publish",
    destructive: "delete_resource",
    external_communication: "send_message",
    unknown: "tool_call",
  };

  return {
    type: typeByEffect[envelope.effect],
    amount: envelope.money?.amount,
    currency: envelope.money?.currency,
    counterparty_id: envelope.subject_id,
    destination: envelope.destination?.value_hash,
    irreversible: envelope.consequences.irreversible,
    creates_commitment: envelope.consequences.creates_commitment,
    metadata: {
      integrity_effect: envelope.effect,
      tool_protocol: envelope.tool.protocol,
      tool_server: envelope.tool.server ?? null,
      tool_name: envelope.tool.name,
      tool_schema_hash: envelope.tool.schema_hash ?? null,
      arguments_hash: envelope.arguments_hash,
      supplier_country: envelope.counterparty?.country ?? null,
      counterparty_domain: envelope.counterparty?.domain ?? null,
      permission: envelope.permissions?.[0] ?? null,
    },
  };
}
