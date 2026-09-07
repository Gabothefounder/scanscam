# ScanScam Integrity — Primitive Red Team v0.1

Date: 2026-09-06

## Executive result

The deterministic Preflight primitive was attacked with a 64-case adversarial suite covering:

- safe baseline behavior and false positives;
- principal mandates and thresholds;
- material state changes;
- implicit commitments;
- evidence verification and freshness;
- new-counterparty risk;
- omitted/malformed input;
- split-payment trajectory attacks;
- irreversible and high-impact actions;
- vocabulary evasion;
- trust-boundary spoofing;
- semantic goal/action gaps.

### Baseline before hardening

- 59 cases
- 23 passed
- 36 failed
- pass rate: 39.0%

### After structural hardening

The same core suite improved to 54/59 (91.5%), then a second adversarial wave expanded the suite to 64 cases.

### Final expanded suite

- 64 cases
- 57 passed
- 7 failed
- pass rate: 89.1%

This is **not a security certification or production accuracy estimate**. It is a deliberately adversarial engineering suite intended to expose primitive design failures.

## What the deterministic core now handles well

The current branch passed every test in these categories:

- safe baseline behavior;
- routine price/invoice changes without excessive friction;
- explicit mandate blocks and approval thresholds;
- payment-destination, bank, wallet, routing and domain changes;
- self-only and stale evidence;
- stake-sensitive new counterparties;
- implicit binding commitments such as contracts, terms, access grants and refunds;
- malformed or missing financial values;
- currency mismatch requiring conversion;
- split-payment aggregation when trusted trajectory data is supplied;
- irreversible actions;
- sensitive-data publication;
- semantic metadata for renamed binding/access actions;
- threshold gaming.

## Remaining failures

### 1. Forged independent evidence

**Attack:** the acting agent marks its own evidence as `verified: true, independent: true`.

**Why rules cannot fix this:** independence and verification are trust properties, not values the caller should be allowed to self-assert.

**Required architecture:** evidence must be represented by a ScanScam-issued/verifier-issued attestation (issuer, timestamp, evidence hash, attestation ID/signature).

---

### 2. Spoofed previous state

**Attack:** the acting agent supplies an attacker-controlled value as both previous and current state, erasing the change.

**Why rules cannot fix this:** ChangeGuard is only meaningful if the baseline is outside the acting agent's control.

**Required architecture:** previous state must come from a server-owned baseline or signed prior integrity receipt, not from the current request body.

---

### 3. Spoofed permissive mandate

**Attack:** the acting agent submits a weaker mandate than the principal actually configured.

**Why rules cannot fix this:** the policy being enforced cannot be supplied by the actor being constrained.

**Required architecture:** requests should reference `principal_id + mandate_version/hash`; ScanScam resolves the authoritative mandate from a principal-controlled store.

---

### 4. Omitted material claim

**Attack:** the agent simply leaves out the premise that caused its action.

**Why rules cannot fix this:** a verifier cannot evaluate a fact it is never shown.

**Required architecture:** the decision capsule should be derived from the runtime trace/tool call/context by an independent capsule builder rather than authored entirely by the acting agent.

---

### 5. Goal/action mismatch

**Attack:** the proposed action is structurally valid but unrelated to the principal's goal.

**Why deterministic rules are insufficient:** this requires semantic comparison between intent and action.

**Required architecture:** semantic normalization/challenge only for high-stakes or ambiguous actions.

---

### 6. Unknown tool with hidden high privilege

**Attack:** a novel action name hides a high-impact operation in unstructured tool/context text.

**Why deterministic rules are insufficient:** tool vocabularies are open-ended.

**Required architecture:** normalize tool specifications into canonical effects/permissions at tool registration or first use; escalate unknown tools to semantic classification.

---

### 7. Natural-language mandate not compiled

**Attack:** the principal has a standing instruction in prose, but it never became a structured rule.

**Why deterministic rules cannot enforce it:** uncompiled human intent is invisible to the policy engine.

**Required architecture:** compile natural-language mandates into structured policy at setup time, with principal review/versioning.

## Architectural conclusion

The product should be split into two layers.

### Fast deterministic layer

Cheap enough to run on nearly every consequential boundary:

- structured mandate evaluation;
- state delta/change checks;
- commitment classification;
- thresholds and aggregation;
- input validation;
- canonical high-impact metadata.

### Trusted/semantic escalation layer

Called only when required:

- authoritative mandate resolution;
- historical baseline lookup;
- evidence attestation;
- independent decision-capsule construction;
- goal/action alignment;
- unknown-tool semantic normalization;
- natural-language mandate compilation.

This preserves the tollbooth economics: most checks are nearly free, while uncertain/high-stakes actions pay for deeper verification.

## Recommendation

Do **not** add x402 billing yet.

Build the trusted-input architecture first:

1. server-owned mandate references;
2. server-owned/signed historical state;
3. attested evidence;
4. independent capsule builder / semantic escalation.

Then repeat this suite and add randomized/fuzzed cases before exposing the primitive as a paid machine service.
