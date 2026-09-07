# ScanScam Integrity Guardian — Red Team v0.5

Date: 2026-09-06

## Current hardened regression result

| Layer | Result |
|---|---:|
| Trusted Inputs v0.2 | 11 / 11 |
| Execution Receipt v0.3 | 13 / 13 |
| Principal / Agent Identity v0.4 | 11 / 11 |
| Execution-bound Guardian v0.5 | 15 / 15 |
| **Total hardened suites** | **50 / 50** |

These are adversarial engineering suites, not a security certification or a calibrated production accuracy estimate.

## Guardian v0.5 — 15/15

The v0.5 suite validates:

1. arbitrary private Value Guard objectives can affect utility without leaking preference reasons;
2. hard approval policy remains separate from soft preferences;
3. explicit hard policy can DENY;
4. soft avoid preferences lower utility without becoming a safety block;
5. the real runtime-observed payment destination change produces CHALLENGE;
6. required semantic inspection fails closed when unavailable;
7. an actor-kind client cannot create the runtime observation used to authorize itself;
8. even a hybrid client cannot spend an observation created by the same client identity;
9. arbitrary policy facts are retained while secrets are omitted and sensitive destinations are hashed;
10. two concurrent 700 CAD requests under a 1000 CAD rolling budget cannot both reserve capacity;
11. failed execution releases its budget reservation;
12. successful execution consumes rolling-window budget;
13. CHALLENGE -> verifier attestation -> retry the same observation -> ALLOW;
14. attestation revocation after Preflight invalidates the authorization at Commit;
15. an actor cannot resolve another principal's observation.

## Legacy v0.1 suite

The raw deterministic v0.1 suite currently reports **56/64**.

This is expected and should not be combined with the v0.5 result.

v0.1 deliberately lacks the later architecture:

- independent runtime observation;
- authoritative principal/client identity;
- server-owned history and mandate;
- trusted verifier identities;
- server-controlled semantics;
- concurrent budget reservations.

One additional legacy test now fails because v0.5 intentionally changed the semantics of `irreversible`: irreversibility alone is context, not sufficient evidence of danger. Destructive/unknown high-impact operations are handled at the Action Envelope / Guardian layer instead of applying friction to every irreversible action.

## Database security verification

All Integrity tables checked in v0.5 have:

- RLS enabled;
- no anon CRUD;
- no authenticated CRUD;
- service-role access.

The critical RPCs checked are:

- `authenticate_integrity_client`
- `resolve_integrity_v05_context`
- `issue_integrity_authorization`
- `get_integrity_budget_usage`
- `commit_integrity_execution`

All are:

- SECURITY INVOKER;
- empty search_path;
- no anon execute;
- no authenticated execute;
- service-role execute only.

The Supabase performance advisor identified three missing v0.5 foreign-key indexes; covering indexes were added for:

- authorization -> observation;
- budget reservation -> client;
- challenge -> observation.

## Interpretation

The v0.5 tests show that the architecture closes the specific attacks represented in the suite.

They do **not** establish:

- production deception recall;
- production false-challenge rate;
- calibrated fraud probability;
- resistance to a fully compromised runtime/host;
- cryptographic non-repudiation of the ScanScam database itself.

Those require the next validation phase.
