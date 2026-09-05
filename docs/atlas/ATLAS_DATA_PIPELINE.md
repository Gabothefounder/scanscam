# Atlas data pipeline v1

## Purpose

Turn ScanScam's existing scan intelligence into a privacy-safe visual Atlas without publishing raw scam messages or private Journey records.

The Atlas has two layers:

- **Currents**: aggregate patterns derived from all scans.
- **Lights**: explicit anonymous Journey contributions from `atlas_contributions`.

## Source inventory (2026-09-05)

The live database contained 1,381 scans. 1,368 already had the main `intel_features` object.

Strong dimensions:
- channel
- requested action
- links/artifact flags
- risk
- tactics / micro-signals

Sparser dimensions:
- narrative family
- authority
- payment method

Therefore v1 preserves uncertainty instead of forcing every scan into a scam family.

## Privacy boundary

`atlas_scan_signals` deliberately excludes:

- raw messages
- free text
- user context text
- phone numbers
- email addresses
- domains / URLs
- evidence
- private Journey ledger content

It stores normalized categories, arrays of safe tags, and boolean artifact flags only.

The scanner's original `intel_features` object must never be copied wholesale into the Atlas because some historical rows contain `user_context_text`.

## Projection

Each scan maps to one `atlas_scan_signals` row.

Core mapping:

| Atlas field | Source |
| --- | --- |
| `risk_tier` | `scans.risk_tier` |
| `risk_score` | `intel_features.risk_score_numeric` |
| `scam_family` | narrative family, then narrative category, then conservative deterministic inference |
| `family_source` | `exact`, `inferred`, or `unclassified` |
| `channel` | `intel_features.channel_type` |
| `authority_type` | `intel_features.authority_type` |
| `primary_request` | requested action, then credential/payment request fallback |
| `payment_intent` | `intel_features.payment_intent` |
| `payment_method` | `intel_features.payment_method` |
| `threat_stage` | `intel_features.threat_stage` |
| `tactic_tags` | emotion vectors + escalation pattern + safe micro-signals |
| `request_tags` | normalized requested actions |
| `emotion_vectors` | existing scanner vectors |
| `brand_mentions` | scanner whitelist-derived brand mentions |
| `artifact_flags` | safe booleans only |

## Current identity

V1 current key:

```
scam_family | channel | primary_request
```

Examples:

```
delivery_scam|other|click_link
government_impersonation|other|pay_money
account_verification|web|submit_credentials
unclassified|sms|click_link
```

`unclassified` is intentional. A scan can still contribute to a useful behavioral current even when its scam family is uncertain.

## Tables

### atlas_scan_signals
Privacy-safe projection of each scan.

### atlas_clusters
Stable current identities.

### atlas_cluster_members
Edges connecting signals to currents.

### atlas_contributions
Explicit Journey contributions. Separate consent object; not a copy of the private ledger.

## Aggregate views

- `atlas_current_summary`
- `atlas_family_summary`
- `atlas_tactic_summary`

These are service-role-only database views. The public frontend reads their aggregate output through `GET /api/atlas/currents`.

## Ongoing sync

The trigger `scans_atlas_sync_v1` runs after inserts or relevant scan updates and calls `private.project_scan_to_atlas_v1(scan_id)`.

The projection is idempotent:
- one Atlas signal per scan
- stable cluster key
- membership replaced if a scan's classification changes

## Design semantics

Recommended visual semantics for the future Atlas:

- current thickness = signal count
- pulse/activity = recency
- intensity = high-risk share
- branch identity = family + channel + request
- smaller filaments = tactic tags
- Lights = explicitly consented Journey contributions
- diffuse/unclassified current = incomplete but still useful pattern evidence

Never visually imply that an inferred family is verified. The UI should preserve exact vs inferred vs unclassified confidence.
