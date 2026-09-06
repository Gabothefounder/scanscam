# ScanScam Integrity — Trusted Inputs v0.2

## Purpose

v0.1 proved that deterministic Change / Mandate / Commitment / Verify checks are useful, but the red team exposed a fatal trust problem: the acting agent could supply the very mandate, historical state, evidence status, or causal story that constrained it.

v0.2 moves authority outside the acting agent.

## Trust boundary

### Caller may report

- `principal_id`
- `subject_id`
- goal
- proposed action
- current observation/state
- causal trace excerpt
- attestation IDs
- tool description

These are treated as observations or references, not authority.

### Server resolves

- active principal mandate
- historical subject baseline
- attestation validity, scope, expiry and revocation

### Server builds

- the canonical Decision Capsule
- material claims recovered from the causal trace
- semantic escalation when deterministic structure is insufficient

### Explicitly ignored if supplied by the caller

- `principal` / caller-authored mandate
- `previous_state`
- caller-authored `verified_evidence`

## Supabase objects

### `integrity_mandates`

Authoritative, versioned principal policy.

Key:
- `principal_id`
- `version`

Important fields:
- `mandate jsonb`
- `mandate_hash`
- `active`

Only one active mandate per principal.

### `integrity_baselines`

Authoritative prior state for a principal + subject.

Key:
- `principal_id`
- `subject_id`

Important fields:
- `version`
- `state jsonb`
- `state_hash`
- `updated_at`

The acting agent cannot supply the baseline used by ChangeGuard.

### `integrity_attestations`

Verifier-issued evidence receipts.

Important fields:
- claim
- issuer
- evidence payload/hash
- observed time
- expiry
- revocation

A caller may provide only an attestation ID. ScanScam determines whether it is valid.

## Data access

All three tables:

- have RLS enabled;
- revoke access from `anon` and `authenticated`;
- grant server-side `service_role` access.

There are intentionally no public RLS allow policies.

## Causal omission defense

Consequential actions require a causal trace excerpt. If the caller omits it, v0.2 fails closed to `VERIFY`.

The server's capsule builder also extracts common material premises from that trace, including:

- changed banking/payment instructions;
- acquisition / ownership change claims;
- new fees;
- identity/destination changes.

This prevents a caller from bypassing Verify simply by leaving `claims=[]`.

## Semantic escalation

The deterministic layer remains the default fast path.

When the action vocabulary is unknown, a tool description is present, or goal/action alignment needs interpretation, v0.2 can send a compact subset to the semantic sensor:

- goal
- proposed action
- tool description
- trace excerpt

The semantic model can flag:

- goal/action mismatch;
- privileged access;
- destructive behavior;
- data disclosure;
- other high-impact effects.

The semantic layer is **not** the trust root. If it is unavailable, server-owned mandates, baselines and attestations remain authoritative.

## Remaining work after v0.2

1. Principal-authenticated mandate authoring/version approval.
2. Baseline update/commit receipts after a confirmed action executes.
3. Real Verify workflow that issues attestations from external evidence.
4. Compile natural-language standing instructions into reviewed structured mandate rules.
5. Persist integrity receipts for audit/reputation/network intelligence.
6. Only then add MCP/x402 billing.
