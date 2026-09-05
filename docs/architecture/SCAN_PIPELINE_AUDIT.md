# ScanScam scanner architecture audit

Status: active refactor plan  
Branch: `work/atlas-emotional-journey-pass`

## Executive summary

The scanner works, but its oldest path has accumulated too many responsibilities in two files:

- `app/api/scan/route.ts`: ~2.4k lines, 60+ local functions
- `app/result/ResultView.tsx`: ~3k lines

Do **not** rewrite the detector in one pass. The accumulated rules contain real product knowledge and calibration work. The safer strategy is:

1. instrument latency and behavior,
2. remove accidental overhead,
3. parallelize independent I/O,
4. extract modules without changing behavior,
5. add characterization fixtures,
6. retire duplicated implementations only after parity checks.

## What was found

### 1. Duplicate scanner logic

The API route contains an older inline feature/taxonomy implementation while newer equivalents exist under `lib/scan-analysis/*`.

Examples include overlapping responsibility for:

- context quality
- channel detection
- narrative/family classification
- requested action
- authority
- payment intent
- micro-signals
- input shape
- risk reconciliation

This is the largest maintainability risk. A future change can update one path while leaving the other path stale.

### 2. Independent network calls were serialized

One important detail from tracing the actual risk path: shortened-link expansion participates in the behavioral/infra interpretation, but the current Web Risk and RDAP results are primarily supporting/display intelligence rather than the canonical core risk decision. That means they are candidates for progressive/background enrichment if timing data shows they dominate latency.

Before this audit, a URL scan effectively waited for:

1. model analysis,
2. shortened URL expansion,
3. Web Risk,
4. RDAP,
5. persistence.

The model and URL intelligence do not depend on one another. Web Risk and RDAP also become independent once the URL to check is known.

Current branch change:

- model analysis and URL intelligence now start together,
- Web Risk and RDAP run in parallel after optional shortened-link expansion,
- timing is recorded in `scan_stage_timing`.

### 3. Screenshot transport used Base64 JSON

The browser converted uploaded screenshots to Base64 before sending JSON. This increases payload size and creates extra browser memory/copying work.

Current branch change:

- screenshots use multipart `FormData`,
- text scans remain JSON.

### 4. Production Web Risk code contained temporary localhost debug requests

Five calls to `127.0.0.1:7734` were present in `webRiskLookup.ts`.

Current branch change:

- all temporary debug network calls removed.

### 5. First paint was unnecessarily hydration-gated

Home, scanner form, dedicated scan page, and header rendered `null` until a client `useEffect` set `mounted=true`.

The initial component state is deterministic, so this delay is unnecessary.

Current branch change:

- scanner surfaces render on the first server pass,
- language still updates after hydration from the query/path when needed.

### 6. Rate limiting and duplicate suppression use process memory

`lib/rateLimit.ts` and `lib/repeatGuard.ts` use module-level `Map` instances.

This is acceptable for a local process but is not a reliable global control across serverless instances and cold starts.

Target:

- move abuse counters / duplicate fingerprints to a shared low-latency store,
- preserve the same privacy boundary: no raw message needs to be stored for duplicate suppression; hash the normalized content.

Do this as a separate behavior change, not inside a cosmetic refactor.

### 7. Model output still uses manual JSON parsing + repair retry

`lib/ai/analyzeScan.ts` currently:

1. calls the model,
2. parses model text,
3. retries with a repair instruction if invalid,
4. uses a hard fallback if repair also fails.

This is robust enough to keep during the first refactor. Later, migrate to schema-constrained structured output so the application receives typed output directly and can remove most parsing/repair code.

Do not combine that change with taxonomy consolidation; isolate model transport changes from classification changes.

## Current request pipeline after the first performance pass

```text
request
  |
  +-- admission / rate limit
  |
  +-- optional OCR (screenshot only)
  |
  +-------------------------------+
  |                               |
  | model analysis                | link intelligence
  |                               |   - extract artifact
  |                               |   - optional short URL expansion
  |                               |   - Web Risk + RDAP in parallel
  +---------------+---------------+
                  |
          deterministic enrichment
                  |
          reconciliation / guardrails
                  |
               persist
                  |
               response
```

Telemetry records:

- total duration
- AI duration
- OCR duration
- link-intelligence duration
- persistence duration

## Target code structure

The API route should become orchestration, ideally a few hundred lines rather than thousands.

Suggested modules:

```text
lib/scan/
  request.ts              parse input, locale, attribution, refinement metadata
  admission.ts            input admission + abuse checks
  ocr.ts                  screenshot normalization / OCR orchestration
  analyze.ts              model invocation
  classify/
    extract.ts             canonical deterministic signals
    taxonomy.ts            canonical enum/taxonomy definitions
    reconcile.ts           AI + deterministic trust-floor reconciliation
    guardrails.ts          thin-input and safety fallbacks
  link/
    extract.ts
    enrich.ts
  persist.ts              canonical scan/raw/image persistence
  response.ts             stable public result shape
  telemetry.ts            server timing helpers
```

Then:

```ts
export async function POST(req: Request) {
  const request = await parseScanRequest(req);
  const admitted = await admitScan(request);
  const normalized = await resolveInput(admitted);

  const [model, linkIntel] = await Promise.all([
    analyze(normalized),
    enrichLinkIntel(normalized.text),
  ]);

  const classification = classifyAndReconcile({ normalized, model, linkIntel });
  const persisted = await persistScan(classification);
  return scanResponse(persisted);
}
```

The important property is not the exact file names. It is **one owner per responsibility**.

## How to retire duplicate taxonomy safely

Do not delete the inline logic simply because a newer module exists.

### Phase A — characterization

Create fixtures from known categories:

- government / parking fine
- delivery
- account verification
- financial phishing
- recovery
- romance
- investment
- employment
- social-engineering opener
- benign / routine
- link-only
- phone-only
- French variants
- contradictory / multi-family messages
- refined-context scans

For each fixture, snapshot the current public outputs:

- risk tier
- narrative family/category
- channel
- requested action
- authority
- threat stage
- context quality
- confidence
- relevant micro-signals

### Phase B — shadow comparison

Run old and canonical classifiers against the same text in tests or a non-user-visible shadow function. Record only normalized differences, never raw text.

### Phase C — switch ownership field by field

For example:

1. context/input shape
2. requested action
3. channel
4. authority
5. narrative family
6. tactics
7. final risk reconciliation

Delete the old implementation only after each field has an explicit canonical owner.

## Result page target

`ResultView.tsx` should also become orchestration.

Suggested components:

```text
ResultView
  RiskSummary
  ImmediateAction
  RecoveryGate
  AtlasBridge
  JourneyBridge
  ContextRefinement
  PartnerEscalation
  ResultFooter
```

The default public result should prioritize:

1. what did we find?
2. what should I do?
3. did I already act?
4. see this pattern in the Atlas
5. understand what happened
6. scan another

The old email-gated report should not dominate the result surface unless new evidence supports it.

## Telemetry / product analytics

Canonical definitions:

- `lib/telemetry/events.ts`
- `docs/telemetry/PRODUCT_ANALYTICS.md`

Service-role-only views:

- `product_events_v1`
- `product_funnel_daily_v1`
- `product_intent_daily_v1`
- `product_scan_performance_daily_v1`

These let an agent answer product questions without touching raw scan text.

## Performance priorities

### Already changed

- parallel model + link intelligence
- parallel Web Risk + RDAP where possible
- multipart screenshot upload
- remove temporary Web Risk debug fetches
- remove unnecessary hydration gate
- add stage timing

### Measure before changing next

Use `product_scan_performance_daily_v1` to identify the true bottleneck.

Then prioritize:

1. **AI dominates** → evaluate model/API transport and prompt/schema size.
2. **Link intel dominates** → tune time budgets/caching or make noncritical enrichment progressive.
3. **OCR dominates** → image preprocessing / OCR provider strategy.
4. **Persistence dominates** → parallelize optional raw/image persistence and inspect DB/storage latency.
5. **Client latency much larger than server total** → payload/network/front-end issue.

Do not guess which of these matters after instrumentation begins collecting real runs.

## Recommended next engineering phases

### Phase 1 — product loop + measurement

Finish:
- homepage intent instrumentation
- post-scan action instrumentation
- Atlas/Journey/Family telemetry
- scanner timing

Observe real traffic.

### Phase 2 — characterization suite

Build fixtures and snapshot current behavior before deleting old scanner logic.

### Phase 3 — scanner modularization

Move pure functions out of the route without changing outputs.

### Phase 4 — canonical classifier

Retire the duplicate inline taxonomy field by field.

### Phase 5 — shared abuse controls

Replace in-memory rate/repeat guards with a shared store.

### Phase 6 — model transport modernization

Move from free-form JSON text + repair retry to schema-constrained structured output.

### Phase 7 — result decomposition

Split `ResultView.tsx` and remove/demote experiments that no longer serve the current product loop.

## Rule for future agents

**Do not make a broad rewrite of `/api/scan` because it looks old.**

The scanner is calibrated production logic. Refactor by preserving observable behavior, measuring before/after latency, and moving one responsibility at a time.
