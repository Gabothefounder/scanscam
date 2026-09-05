# ScanScam Evaluation Lab

This directory is deliberately separate from the production `/api/scan` path.

It exists so ScanScam can improve continuously without silently changing production behavior.

## Two test sets

### 1. Gold set

Human-reviewed, difficult examples with trusted labels. This is the release gate.

Target composition:
- real public scam/phishing examples where licensing permits
- consented/anonymized historical ScanScam cases
- difficult benign near-misses
- English/French matched pairs
- OCR-corrupted examples
- link-only and context-poor inputs

A model/rule change never ships merely because it wins on synthetic data.

### 2. Stress set

Large deterministic variations used for regression, language parity, robustness, latency, and schema reliability.

Generate 1,000:

```bash
npm run eval:generate
```

Run current rules + candidate models:

```bash
EVAL_MODELS=gpt-4o-mini,gpt-5.6-luna npm run eval:models
```

The runner does **not** call the public ScanScam endpoint and does not write to production scan tables or product telemetry.

## Initial candidate models

- `gpt-4o-mini` — current production baseline.
- `gpt-5.6-luna` — first modern workhorse candidate.
- optionally `gpt-5.4-nano`, `gpt-5-mini`, or `gpt-5.4-mini` for comparison.

Do not promote a model based only on model-brand intuition. Compare:
- high-risk/insufficient-context behavior
- family extraction
- requested action
- French/English parity
- false positives on benign messages
- p50/p90 latency
- schema/API failures
- input/output tokens and estimated cost

## Controlled recursive improvement

ScanScam should be semi-recursive, not self-modifying.

### Weekly drift review
1. Look at new normalized production signals and telemetry.
2. Find high-uncertainty, fallback, disagreement, and user-refinement clusters.
3. Add representative privacy-safe cases to a candidate eval queue.
4. Run the frozen gold set + stress set against the current engine and candidates.
5. Produce a proposal. Do not change production automatically.

### Monthly improvement review
Evaluate proposed:
- taxonomy additions
- deterministic rules
- prompt/schema changes
- model changes
- routing/fast paths

A change is promotable only if:
- high-risk recall does not materially regress,
- benign false positives do not materially increase,
- French parity stays within the agreed tolerance,
- schema failure rate stays near zero,
- latency/cost stay acceptable,
- newly fixed failure classes have explicit regression cases.

## Privacy rule

Eval artifacts must not become a second raw-message warehouse.

Historical private cases should be:
- included only when permitted by the product's consent/retention policy,
- redacted or transformed where possible,
- isolated from public fixtures,
- never committed to Git.

The repository should contain only public/synthetic/redacted examples.
