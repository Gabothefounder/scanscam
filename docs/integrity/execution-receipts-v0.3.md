# ScanScam Integrity — Execution Receipt / Commit v0.3

Date: 2026-09-06

## Purpose

Trusted Preflight v0.2 moved mandate, historical state, and evidence authority outside the acting agent.

v0.3 closes the next gap: an agent that receives `ALLOW` cannot later execute a different action, replay the same authorization to advance state twice, use an expired/stale authorization, or rewrite trusted history with arbitrary post-execution state.

## Protocol

1. Caller submits Trusted Preflight request.
2. ScanScam resolves authoritative mandate/baseline/attestations and evaluates the action.
3. Only `ALLOW` may issue an authorization receipt.
4. The authorization contains an opaque one-time bearer token; only its SHA-256 hash is persisted.
5. Authorization is bound to:
   - exact proposed-action hash;
   - principal;
   - subject;
   - mandate version + hash;
   - baseline version + hash;
   - Preflight-observed state hash;
   - expiry;
   - decision context hash.
6. Agent/executor performs the action.
7. Commit validates the receipt atomically inside Postgres.
8. An execution receipt is created and the authorization is consumed.
9. Authoritative baseline state advances only when the state supplied at Commit exactly matches the state already evaluated/bound at Preflight.

## Database objects

### `integrity_authorizations`

One-time authorization records.

Important fields:

- principal / subject
- exact action JSON + action hash
- mandate version/hash
- baseline version/hash
- observed-state hash
- one-time token hash
- issued/consumed/revoked/expired status
- expiry

The raw bearer token is never stored.

### `integrity_execution_receipts`

Immutable execution-level receipt data for one authorization.

Important fields:

- authorization ID
- principal / subject
- execution outcome
- authorized action hash
- resulting-state payload/hash when applicable
- external execution reference
- execution timestamp
- baseline version after Commit

One execution receipt is allowed per authorization.

### `commit_integrity_execution(...)`

Atomic Postgres transaction.

Security posture:

- `SECURITY INVOKER`
- empty `search_path`
- no EXECUTE for PUBLIC / anon / authenticated
- EXECUTE for server-side service role only

The transaction locks the authorization and relevant baseline before it checks or mutates anything.

## Important distinction: execution ledger vs authoritative world-state

Successful execution always creates an execution receipt.

It does **not** automatically let the caller rewrite the trusted baseline.

Baseline mutation rules:

- if Preflight observed no state transition, Commit leaves baseline unchanged;
- if Preflight evaluated a concrete state transition, Commit may advance only to that exact state hash;
- a caller-supplied state that differs from the Preflight-bound state is rejected;
- a new authoritative baseline is never bootstrapped from a post-hoc caller claim.

This prevents the acting agent from turning a legitimate execution authorization into arbitrary history-writing authority.

## Idempotency

An identical Commit retry after a successful Commit returns the original execution receipt with `replayed: true`.

No second baseline transition occurs.

This handles lost HTTP responses / network retries without weakening one-time execution semantics.

## Red team v0.3

Final stateful preview suite: **13/13 passed**.

Cases:

1. exact authorized action commits;
2. identical retry returns the same receipt without another state transition;
3. altered action is rejected;
4. incorrect bearer token is rejected;
5. legitimate retry after rejected tamper attempts still succeeds;
6. arbitrary resulting-state/history poisoning is rejected;
7. exact Preflight-bound benign state transition can advance baseline;
8. required authorized transition state cannot be omitted;
9. stale baseline invalidates authorization;
10. expired authorization is rejected;
11. failed execution consumes receipt without advancing history;
12. mandate revision invalidates the old authorization;
13. caller cannot bootstrap a new trusted baseline from post-hoc state.

## Supabase posture

New receipt tables have RLS enabled and no SELECT grant for `anon` or `authenticated`.

The Supabase advisor reports only the expected informational "RLS enabled with no policy" notices for Integrity tables because they are deliberately server-only. Newly-created indexes are also reported as unused because the prototype traffic is minimal.

## Preview-only restriction

v0.3 endpoints deliberately return 404 in the production Vercel environment.

Reason: principal/client authentication is not implemented yet.

Before any public machine-facing deployment, the caller must be cryptographically/authentically bound to the principal it is acting for. A caller must not be able to choose another principal simply by submitting a different `principal_id`.

## Next blocker before MCP / x402

Build principal/client identity:

- principal-controlled client registration;
- hashed API credential or signed agent identity;
- scopes;
- credential rotation/revocation;
- resolve `principal_id` from the authenticated client rather than trusting it from the request body.

After that, the current authorization/commit protocol becomes a credible base for a paid machine-to-machine integrity service.
