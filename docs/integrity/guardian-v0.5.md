# ScanScam Integrity Guardian v0.5

Date: 2026-09-06

## Product definition

ScanScam Integrity Guardian is an execution-bound integrity interlock for autonomous agents.

It does not ask the acting agent to describe what it intends to do and then trust that description. An independent runtime observer captures the actual pre-execution tool call, normalizes it into a canonical Action Envelope, and ScanScam evaluates that observed action against principal-controlled policy, trusted history, evidence, budgets, and deception/context signals.

## Core invariant

**The actor being constrained must not be the sole source of either the authority or the observation used to constrain it.**

## v0.5 execution path

```text
Agent
  |
  | actual tool invocation
  v
Runtime hook / observer
  |
  | canonical Action Envelope
  v
ScanScam Integrity Guardian
  |
  +-- Value Guard
  +-- Mandate / hard policy
  +-- Change Guard
  +-- Commitment Guard
  +-- Deception context
  +-- Trusted history
  +-- Attestations
  +-- Server-controlled semantic escalation
  +-- Atomic budgets
  |
  +--> ALLOW ----------------> client-bound authorization
  |
  +--> CHALLENGE ------------> proof requirement(s)
  |                              |
  |                              v
  |                           verifier
  |                              |
  |                         attestation
  |                              |
  |                     retry same observation
  |
  +--> APPROVAL_REQUIRED ----> principal approval workflow
  |
  +--> DENY -----------------> no execution
```

## Canonical Action Envelope

The runtime observer normalizes arbitrary tool names into real-world effects rather than trusting vocabulary such as `send_payment`.

Current effect vocabulary:

- financial_transfer
- purchase
- contract_acceptance
- access_grant
- publication
- data_disclosure
- destructive
- external_communication
- unknown

The envelope also binds:

- tool protocol/server/name/schema hash;
- canonical subject;
- amount/currency;
- counterparty;
- destination hash;
- resource;
- permissions;
- irreversible/commitment effects;
- complete arguments hash;
- privacy-sanitized arbitrary policy facts.

The core is protocol-neutral. ACS, MCP, A2A, HTTP and native runtimes should be adapters into this envelope.

## Value Guard: arbitrary principal policy

Value Guard is **not** a Canadian-supplier or ESG feature.

The principal may express any structured preference or constraint that can be evaluated against observed facts.

### Hard policy examples

```yaml
- never send files outside Canada
- require approval before using vendor X
- never purchase from marketplace Y
- require approval for red-eye travel
- never grant production admin access
- never pay in cryptocurrency
- maximum autonomous spend: 500 CAD
```

Hard rules can produce APPROVAL_REQUIRED or DENY.

### Soft objective examples

```yaml
- prefer Canadian suppliers: +60
- prefer Quebec suppliers: +20
- prefer lower-carbon transport: +15
- avoid red-eye flights: -50
- prefer morning departures: +40
- prefer refundable fares: +25
- prefer vendors with 30-day terms: +15
- avoid vendors that monetize personal data: -80
- prefer lower latency: +10
- prefer open-source software: +20
```

Soft objectives affect utility/ranking, not fraud risk.

### Arbitrary policy facts

The Action Envelope preserves privacy-sanitized facts from the real tool arguments so policy can reference application-specific fields such as:

```text
supplier_country
brand
data_residency
flight.departure_time
flight.red_eye
warranty_years
hosting.region
merchant.category
delivery.days
contract.jurisdiction
```

Secret-looking values are omitted. Sensitive destinations such as bank accounts and wallets are hashed.

### Privacy rule

Private preferences should guide the principal's agent without becoming negotiating intelligence for the counterparty.

The public Guardian result returns:

- aggregate preference score;
- match count;
- private-match count.

It does not emit the principal's private preference reasons into normal decision signals.

## Runtime observation

v0.5 separates actor and observer clients.

Observer kinds:

- observer
- hybrid

Observer scope:

- observe:write

The observer sees the actual pre-execution tool call and stores only:

- canonical Action Envelope;
- selected state snapshot;
- hashes;
- bounded causal context;
- timestamps.

Raw tool arguments are not persisted by the observer.

An actor cannot spend an observation authored by the same client ID.

## Server-controlled semantics

The actor cannot choose `semantic_mode=off` in v0.5.

Server policy requires semantic inspection when, for example:

- effect normalization remains unknown;
- deterministic deception signals are material;
- base integrity risk is high.

When semantics are required but unavailable:

```text
SEMANTIC_REQUIRED_UNAVAILABLE
=> CHALLENGE
```

This is fail-closed for required semantic inspection.

## Concurrent budgets

Budgets are principal policy and are enforced at authorization issuance, not trusted from actor context.

Example:

```yaml
id: hourly-agent-spend
limit: 1000
currency: CAD
window_seconds: 3600
effects:
  - financial_transfer
mode: approval
```

Authorization issuance uses a transaction-level advisory lock per principal/budget.

If two agents simultaneously request 700 CAD under a 1000 CAD budget:

- one may reserve 700;
- the other sees the reservation and cannot also reserve 700.

Failed execution releases the reservation.

Successful execution commits it into the rolling window.

Expired authorization expires its reservation.

## Challenge protocol

CHALLENGE is not a dead-end status.

The result contains exact requirements such as:

```json
{
  "kind": "attestation",
  "claim": "Counterparty payment or destination instructions changed.",
  "reason": "Provide an independent verifier attestation for this material premise."
}
```

The challenge is persisted against:

- principal;
- actor client;
- exact observation;
- exact action hash.

A verifier issues an attestation.

The actor retries the **same observation** with the attestation ID.

Verified evidence can discharge the matching change/deception signal.

Possible result:

```text
CHALLENGE
  -> verifier attestation
  -> retry same observation
  -> ALLOW
```

## Verifier model

Verifier is a role, not a moral label.

Examples:

- banking verification adapter;
- corporate registry lookup;
- domain/DNS verifier;
- signed vendor record;
- principal-controlled human approval service;
- independent machine agent;
- platform-native identity/evidence provider.

v0.5 verifier clients have:

- kind verifier/hybrid;
- attest:write;
- principal binding;
- credential lifecycle.

Attestations bind:

- issuer client;
- principal;
- claim;
- evidence hash;
- observation time;
- expiry/revocation;
- trust level.

Commit rechecks bound attestations. If evidence is revoked or expires after Preflight but before execution, Commit returns:

`authorization_attestation_stale`

## Decision vocabulary

### ALLOW

No currently material control blocks autonomous execution. A client-bound authorization may be issued.

### CHALLENGE

A factual/integrity uncertainty must be resolved before execution.

Typical resolution: attestation, fresh runtime context, trusted baseline, or semantic retry.

### APPROVAL_REQUIRED

The action is understood, but principal policy says autonomy is insufficient.

This is deliberately separate from factual uncertainty.

### DENY

Principal policy explicitly prohibits the action.

## Intervention score

`intervention_score` is an engineering prioritization score, **not a probability of fraud**.

Do not market it as a calibrated probability until real-world outcome data supports calibration.

## ACS adapter

The Guardian core remains protocol-neutral.

A public-preview ACS adapter maps the ACS pre-execution `toolCallRequest` hook into ScanScam's runtime observation format.

Keep ACS schema-specific evolution inside the adapter rather than coupling the Guardian core to one instrumentation standard.

## Economics

The intended cost architecture is:

### cheap/local or deterministic

- Action Envelope normalization;
- hard mandate checks;
- Value Guard;
- known history delta;
- cached policy;
- simple budget logic.

### paid cloud escalation

- semantic deception/context analysis;
- network reputation/intelligence;
- external verification;
- attestation resolution;
- cross-agent campaign intelligence;
- high-value challenge workflows.

The economic primitive remains:

**Pay on consequential uncertainty, not on every token or every trivial agent action.**

## Remaining work before public billing

1. Validate a real ACS runtime integration end-to-end.
2. Add MCP/A2A adapters only after the core runtime contract is stable.
3. Add signed/append-only receipts before making tamper-proof/non-repudiation claims.
4. Build human principal bootstrap/account onboarding.
5. Add real external verifier adapters.
6. Measure latency, cloud-call rate, false-challenge rate, and cost/action under realistic workloads.
7. Then introduce metering/x402 or conventional prepaid credits.
