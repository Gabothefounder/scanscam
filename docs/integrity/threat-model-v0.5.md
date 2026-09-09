# ScanScam Integrity Guardian — Threat Model v0.5

Date: 2026-09-06

## Security objective

Preserve the principal's intent when an autonomous agent is about to perform a consequential action.

The Guardian should make it difficult for an acting agent to:

- rewrite the policy that constrains it;
- invent the historical state used to judge change;
- claim that evidence is verified when it is not;
- describe a different action than the one actually sent to a tool;
- exceed concurrent or rolling budgets through race conditions;
- spend another agent's authorization;
- replay an authorization to create a second state transition;
- silently disable a semantic check required by server policy;
- turn a legitimate execution authorization into arbitrary trusted history.

## Trust zones

### Principal-controlled authority

Trusted:

- active mandate/version;
- hard rules;
- soft Value Guard objectives;
- rolling/concurrent budgets;
- client/observer registration;
- verifier trust configuration.

Stored outside the acting agent's request.

### Runtime observer

Trusted for the pre-execution tool-call observation.

The observer sees the actual tool name and arguments at the execution boundary and produces a short-lived canonical Action Envelope.

The acting client cannot spend an observation it authored itself.

### Acting client

Untrusted for authority and security-critical observation.

It may request evaluation and carry references/receipts, but v0.5 does not trust it to supply:

- principal identity;
- authoritative mandate;
- prior state;
- aggregate spend;
- semantic mode;
- verified evidence;
- actual tool arguments;
- current security-relevant state;
- causal context for the tool call.

### Verifiers

Attestations are trusted only after server-side resolution of issuer, scope, expiry, and revocation.

A future version must add stronger issuer trust levels and signed attestations.

## Threats v0.5 directly addresses

### Policy substitution

Attack: acting agent submits a weaker mandate.

Control: principal mandate is resolved server-side.

### Historical-state spoofing

Attack: acting agent supplies fake previous state to erase a change.

Control: baseline is resolved server-side.

### Action substitution

Attack: agent asks approval for action A and executes action B.

Control: runtime observer normalizes the actual tool call; authorization is bound to the canonical action hash.

### Observation self-authorship

Attack: acting client creates the observation that supposedly proves its own action.

Control: actor and observer are separate client identities; the same client cannot spend its own observation.

### Evidence self-verification

Attack: agent sends `verified: true`.

Control: caller verification flags are ignored; only server-resolved attestations produce verified evidence.

### Replay

Attack: reuse a successful authorization.

Control: one execution receipt per authorization; identical network retries are idempotent.

### Cross-client receipt theft

Attack: another agent obtains the authorization token.

Control: authorization is bound to the issuing client ID.

### Concurrent budget race

Attack: two agents simultaneously see the same remaining allowance.

Control: authorization issuance takes a transaction-level advisory lock per principal/budget and reserves allowance atomically.

### History poisoning

Attack: after a valid action, agent submits arbitrary new state.

Control: baseline may only move to an exact state hash already evaluated and bound before execution.

### Semantic-check suppression

Attack: acting agent requests `semantic_mode=off`.

Control: v0.5 does not accept caller semantic mode. Server policy decides whether deep semantic inspection is required. Required-but-unavailable semantic inspection fails closed to CHALLENGE.

## Partially addressed threats

### Malicious external tool/server

The Guardian can inspect the outbound action and compare claims/state, but a malicious external system can still lie about facts it exclusively controls.

Mitigation path:

- independent verification;
- attestation issuer trust;
- reputation/history;
- multiple evidence sources.

### Prompt injection / manipulated causal context

The observer supplies the causal context from the runtime rather than trusting a separate actor request. The Guardian detects some deterministic deception patterns and escalates ambiguous/high-risk cases to semantic inspection.

This is not a proof that the causal story is complete or true.

### Stolen actor API credential

A stolen credential impersonates that client until revoked.

Controls still limit the attacker to:

- that client's scopes;
- principal mandate;
- runtime-observed action;
- budgets;
- one-time authorizations.

Future improvement: short-lived OAuth/MCP credentials or workload identity.

## Explicit non-goals in v0.5

### Fully compromised host/runtime

If an attacker controls the host strongly enough to:

- forge the independent observer;
- bypass the hook entirely;
- steal all machine credentials;
- alter the application after Guardian approval;

v0.5 cannot guarantee enforcement.

Future options include:

- platform-native enforcement hooks;
- workload identity;
- signed observer events;
- remote/hardware attestation;
- execution-side verification.

### Compromised ScanScam service role/database administrator

Server-controlled state is authoritative in v0.5. A fully compromised service role can mutate it.

Before marketing receipts as immutable/non-repudiable, add:

- append-only audit semantics;
- signed receipts;
- signing-key IDs/rotation;
- external anchoring or write-once audit storage.

### Universal truth oracle

ScanScam can require evidence, compare independent sources, and track change. It cannot guarantee that every external factual claim is true.

### Availability

DoS, regional outages, model outages, and network partitions are not solved by the integrity protocol. For consequential actions, security policy may choose fail-closed behavior.

## Privacy model

Value Guard policy is private principal intelligence.

The Guardian should reveal the minimum required result:

- disposition;
- required control;
- aggregate preference score when useful.

Private objectives and willingness-to-pay thresholds should not be disclosed to merchants/counterparties.

Runtime observations persist:

- selected canonical facts;
- privacy-sanitized policy facts;
- hashes of sensitive destinations and full arguments;
- short causal context when needed.

Raw tool arguments are not persisted by the v0.5 observer.

## Architectural invariant

**The actor being constrained must not be the sole source of the authority or observation used to constrain it.**

This is the central v0.5 design rule.
