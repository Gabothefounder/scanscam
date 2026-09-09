# ScanScam Value Guard — Human Preference Layer v0.6

Date: 2026-09-06

## Product principle

**Teach it, do not configure it.**

People should not have to invent coefficients such as `Canada +20`, `privacy +35`, or `price -10`.

The person speaks normally. Value Guard compiles those statements into a private, structured policy that can be evaluated by ScanScam Integrity Guardian.

Numeric coefficients exist only as an implementation detail and are hidden by default.

## Three distinct kinds of human intent

### 1. Hard boundaries

These require explicit human language.

Examples:

- Never use vendor X.
- Do not send confidential files outside Canada.
- Ask me before spending more than 2,500 CAD.
- Ask before booking a red-eye.
- Never grant production administrator access.

Hard boundaries compile into deterministic Guardian rules:

- `DENY`
- `APPROVAL_REQUIRED`

The coach must never infer a hard boundary merely because a person expressed a preference.

### 2. Operational preferences

These are trade-offs rather than prohibitions.

Examples:

- Prefer Canadian suppliers.
- Prefer lower price.
- Prefer direct flights.
- Avoid services that sell personal data.
- Prefer longer warranties.
- Prefer lower latency.

The human sees qualitative language:

- light
- moderate
- strong
- very strong
- confidence / still learning

Internally, the compiler may derive coefficients so alternatives can be compared.

### 3. Qualitative but unresolved values

Sometimes a person clearly cares about something but has not defined what it means operationally.

Example:

> Privacy matters a lot to me.

Value Guard should **remember that strongly without inventing a numeric privacy metric**.

The profile can retain:

- strong qualitative preference;
- high confidence that the value matters;
- unresolved operational definition.

The coach can then ask a concrete follow-up:

> When you say privacy matters, what should I optimize for most: no sale of personal data, no model training, data residency, minimal data collection, or something else?

Until clarified, the preference remains real but does not pretend to be mechanically measurable.

## Conversation model

The coach asks one high-information question at a time.

It prefers concrete trade-off questions over abstract ratings.

Examples:

- Would you still prefer the Canadian option if it cost 10% more?
- Should red-eye flights be something I avoid when possible, or something I must always ask you about?
- You said privacy is important. Is selling personal data a hard boundary, or simply a strong negative preference?
- If a direct flight costs 120 CAD more, would you usually take it?

A rich answer may establish several pieces of policy at once.

The coach should normally continue for a few useful turns rather than presenting a long onboarding questionnaire.

## Trade-off tolerance is separate from preference strength

A person can strongly prefer something while still imposing an economic limit.

Example:

- Prefer Canadian supplier: strong
- Maximum tolerated premium for that preference: approximately 12%

Then:

- 100 CAD US vs 108 CAD Canadian -> Canadian preference can win
- 100 CAD US vs 125 CAD Canadian -> the learned 12% premium tolerance is exceeded

This is different from saying the value itself became weaker.

## Confidence and provenance

Each learned preference carries a confidence and source.

Possible sources:

- explicit
- tradeoff
- observed_choice
- inferred

Typical policy:

- explicit boundaries: confidence near 1.0
- explicit preference: high confidence
- trade-off answer: medium/high confidence
- weak inference: low confidence

Low-confidence preferences should not dominate consequential decisions.

## Country and other canonical facts

The conversational layer normalizes common values into the machine representation expected by the Guardian.

Example:

- Canada / Canadian -> `CA`
- United States / USA -> `US`

The person never needs to know the canonical code.

## Privacy

The Value Guard profile is private principal intelligence.

Current v0.6 preview behavior:

- raw conversational answers are **not persisted**;
- OpenAI Responses calls use `store: false`;
- only the structured profile and short structured provenance summaries are stored;
- Value Guard tables are server-only;
- the normal UI does not expose machine coefficients;
- private preferences should never become negotiating intelligence for a merchant/counterparty.

## Persistence

Server-side tables:

- `integrity_value_profiles`
- `integrity_value_events`

A draft stores:

- structured human profile;
- deterministic profile hash;
- compiled Guardian mandate;
- deterministic mandate hash;
- question count;
- structured provenance events.

## Publishing to Guardian

The person can publish the current profile.

Publishing:

1. compiles the human profile deterministically;
2. creates the next active `integrity_mandates` version for that principal;
3. deactivates the prior mandate;
4. records the mandate hash/version.

Thus the conversational layer does not become the runtime enforcement system. It compiles into the same server-owned Guardian policy already used by the execution-bound integrity stack.

## Decision sandbox

v0.6 includes a tiny decision sandbox.

It accepts 2-8 caller-supplied structured options and evaluates them against the current profile.

It deliberately does **not**:

- search the web;
- find products;
- negotiate;
- book;
- purchase;
- transact.

This is not a buying agent. It is a way to verify that the learned Value Guard behaves as the person expects.

## Human UI

Preview page:

`/integrity/value-guard`

Layout:

- conversational teaching surface;
- live structured interpretation;
- hard boundaries;
- preferences;
- confidence;
- trade-off tolerance;
- unresolved values;
- profile maturity;
- publish-to-Guardian action;
- optional decision sandbox;
- advanced machine-policy view hidden by default.

## Deterministic regression properties

The v0.6 deterministic suite checks:

- an empty profile invents no policy;
- hard rules remain hard;
- soft preferences do not become hard rules;
- relative numeric preferences remain option-level preferences;
- premium tolerance is separate from strength;
- hard blocks cannot be outweighed by utility;
- approval is distinct from denial;
- compilation is deterministic;
- publishing activates the exact compiled mandate hash.

A separate live-coach suite tests natural-language compilation and verifies that raw human answers are not persisted.

## Not implemented yet

### Automatic learning from real decisions

The schema includes `learned_from_decisions`, but v0.6 does not yet silently rewrite policy from observed behavior.

Before adding that, the learning loop should require:

- repeated evidence;
- confidence update rules;
- protection against manipulated/forced decisions;
- ability for the principal to inspect/correct what was learned;
- hard rule protection (behavior must never silently overwrite an explicit boundary).

### Buying agent

Intentionally deferred.

Value Guard is infrastructure. A buying agent is one possible future application.

## Next system step

After v0.6 human preference compilation is validated, return to the main Guardian roadmap:

1. run one real end-to-end ACS/runtime integration;
2. measure p50/p95 latency and cloud escalation rate;
3. measure false CHALLENGE rate and cost per consequential action;
4. then design the SDK/MCP/A2A and metering surfaces.

Do not add a shopping application unless it becomes useful as a narrow demonstration.
