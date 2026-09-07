# ScanScam Integrity — Principal / Agent Identity v0.4

Date: 2026-09-06

## Purpose

v0.1–v0.3 established:

- deterministic integrity checks;
- server-owned mandates, baselines and attestations;
- one-time action authorization;
- atomic execution receipts and controlled state evolution.

v0.4 closes the next trust boundary: the caller may no longer choose which principal it acts for by submitting `principal_id`.

The principal is derived from an authenticated, scoped machine client.

## Credential model

An Integrity client has a stable identity:

- `client_id`
- `principal_id`
- name
- scopes
- active/suspended/revoked status

Credentials are separate from clients so keys can rotate without changing agent identity.

### `integrity_clients`

Principal-owned machine identities.

Supported scopes:

- `preflight:write`
- `commit:write`
- `clients:manage`

Database CHECK constraints reject unknown scopes.

### `integrity_client_credentials`

Rotatable bearer credentials.

The raw API key is shown only when issued.

Persisted fields include:

- credential ID
- client ID
- SHA-256 key hash
- non-secret key prefix
- expiry
- revocation timestamp
- throttled last-used timestamp

The raw API key is never persisted.

Key format:

`ssi_v1_<random 256-bit secret>`

## Authentication flow

Caller sends:

`Authorization: Bearer ssi_v1_...`

Server:

1. hashes the supplied key;
2. resolves a non-revoked credential;
3. checks credential expiry;
4. resolves the active client;
5. checks the required scope;
6. derives `client_id` and `principal_id`;
7. only then evaluates the request.

## Principal binding

A Preflight body may still contain `principal_id` for backwards-compatibility testing, but it is not authoritative.

The API builds:

`trustedRequest.principal_id = authenticatedClient.principal_id`

If the body contains `principal_id`, it is surfaced as:

`UNTRUSTED_AUTHORITY_IGNORED`

The authenticated identity is the only principal source at the API boundary.

## Authorization binding

v0.3 authorizations now persist `client_id`.

Commit receives the currently authenticated client ID and atomically verifies:

`authorization.client_id == authenticated_client.client_id`

Therefore:

- another principal cannot spend the receipt;
- another client under the same principal cannot spend the receipt;
- a rotated credential for the same client can continue representing that same client identity.

## Client control plane

Preview route:

`/api/integrity/clients`

Requires:

`clients:manage`

A manager client can only operate inside its own authenticated principal.

Supported operations:

### List clients

`GET /api/integrity/clients`

Returns client metadata, never raw credentials.

### Create client

`POST { action: "create_client", name, scopes, expires_at? }`

The principal is derived from the manager identity.

A new API secret is returned once.

### Rotate credential

`POST { action: "rotate_credential", client_id, revoke_credential_id?, expires_at? }`

Ownership is checked before rotation.

### Revoke credential

`POST { action: "revoke_credential", client_id, credential_id }`

### Revoke client

`POST { action: "revoke_client", client_id }`

Revoking a client also revokes its live credentials.

A manager is prevented from revoking its own current client through this endpoint.

## Tollbooth-cost consideration

Authentication does not write `last_used_at` on every machine request.

Usage timestamps are refreshed at most once per ~15 minutes per credential, avoiding a database write on every Preflight/Commit call.

## Database security

`integrity_clients` and `integrity_client_credentials`:

- RLS enabled;
- anon SELECT: false;
- authenticated SELECT: false;
- service-role SELECT: true.

The Commit function remains:

- SECURITY INVOKER;
- empty search_path;
- no EXECUTE for PUBLIC / anon / authenticated;
- service-role only.

The Supabase advisor's Integrity notices are the expected informational "RLS enabled with no policy" messages because these tables are intentionally server-only.

## v0.4 red team

Identity suite: **11/11 passed**.

Cases:

1. valid key resolves the correct client/principal;
2. body-level principal spoof is ignored;
3. scope denial works;
4. expired credential is denied;
5. revoked credential is denied;
6. credential rotation revokes old key and preserves client identity;
7. client revocation invalidates credentials;
8. cross-client execution-receipt theft is blocked;
9. manager cannot target a client owned by another principal;
10. unknown key is denied;
11. authenticated identity never contains the raw API key.

Regression suites after v0.4 identity changes:

- Trusted Inputs v0.2: **11/11**
- Execution Receipt v0.3: **13/13**
- Principal / Agent Identity v0.4: **11/11**

## Production lock

All Integrity machine APIs and red-team routes remain preview-only.

Production returns 404 for the prototype endpoints, including legacy v0.1 routes.

This prevents an accidental merge from exposing an unauthenticated prototype.

## Remaining bootstrap boundary

v0.4 provides principal-controlled machine-client management **after a manager client exists**.

The very first `clients:manage` credential is still provisioned server-side.

For a public product, that bootstrap should eventually be tied to a human/account onboarding path (for example authenticated ScanScam account + explicit principal creation).

This is an onboarding/control-plane concern, not an agent-action trust gap.

## Readiness for the next prototype layer

With v0.4, the machine trust chain is:

authenticated client
→ authenticated principal
→ trusted mandate/history/evidence
→ Preflight
→ one-time client-bound authorization
→ exact execution
→ atomic execution receipt
→ controlled state evolution.

That is sufficient to begin a preview-only SDK / MCP / metered-machine-service integration without exposing production.
