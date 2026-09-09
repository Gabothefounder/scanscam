# @scanscam/integrity-sdk

Dependency-free TypeScript client for the frozen ScanScam Integrity **v1** HTTP contract.

The SDK deliberately keeps actor, observer, and verifier credentials separate. Create one client per credential/role.

```ts
import { createIntegrityClient } from "@scanscam/integrity-sdk";

const observer = createIntegrityClient({
  baseUrl: "https://your-integrity-host.example",
  apiKey: process.env.INTEGRITY_OBSERVER_KEY!,
});

const actor = createIntegrityClient({
  baseUrl: "https://your-integrity-host.example",
  apiKey: process.env.INTEGRITY_ACTOR_KEY!,
});

const observation = await observer.observe({
  protocol: "mcp",
  step_id: "tool-call-123",
  goal: "Pay an approved invoice",
  causal_context: "Routine invoice; supplier instructions unchanged.",
  tool: {
    name: "pay_invoice",
    server: "example-mcp",
  },
  arguments: {
    vendor: "ACME",
    amount: 300,
    currency: "CAD",
    bank_account: "RBC-1111",
  },
});

const decision = await actor.preflight({
  observation_id: observation.observation_id,
});

if (decision.disposition === "ALLOW" && decision.authorization) {
  // Execute the exact authorized action, then commit the observed outcome.
}
```

## Methods

- `observe()` — independent runtime hook records the proposed tool call.
- `preflight()` — actor asks Guardian for ALLOW / CHALLENGE / APPROVAL_REQUIRED / DENY.
- `attest()` — independent verifier issues evidence.
- `retryChallenge()` — actor retries an open challenge with attestation IDs.
- `commit()` — actor settles the exact execution against the one-time authorization.

The v1 contract intentionally exposes fewer fields than internal Guardian responses so internals can evolve without breaking integrations.
