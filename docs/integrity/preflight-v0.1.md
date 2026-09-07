# ScanScam Integrity — Preflight v0.1

Preflight is an independent integrity checkpoint for consequential agent actions.

It is intentionally **not** a generic agent firewall and does not try to make the acting model smarter. It asks whether the action is still consistent with the principal's mandate and with the situation the agent believes it is acting in.

## Decision capsule

The API accepts a compact, machine-readable decision capsule containing:

- the proposed action;
- the principal mandate;
- previous and current state;
- material claims and their evidence;
- optional context.

Only `proposed_action.type` is required. More context improves the check.

## v0.1 checks

1. **Change** — detects material state changes, especially payment, identity, price, permission, access, contract and counterparty changes.
2. **Mandate** — enforces autonomous spend thresholds, blocked/approval action types and structured principal rules.
3. **Commitment** — identifies actions that bind the principal (payments, fees, contracts, refunds, access, publication, bookings, etc.).
4. **Verify** — flags material claims that lack independent verified evidence.
5. **Challenge** — increases scrutiny for irreversible actions and cases where multiple checks disagree with execution.

## Decisions

- `ALLOW` — no material integrity condition requires intervention.
- `VERIFY` — independent verification is required before proceeding.
- `HOLD` — execution should pause pending a required control or approval.
- `BLOCK` — the principal mandate forbids the action.

## Privacy

v0.1 is deterministic. The `/api/preflight` route does **not** persist the submitted capsule and does not call an LLM.

That is deliberate: the first version should prove that useful interception is possible without shipping private agent context to another model.

## Example: vendor bank change

```json
{
  "goal": "Pay the normal ACME invoice",
  "proposed_action": {
    "type": "change_vendor_bank_account",
    "amount": 14300,
    "currency": "CAD",
    "counterparty_id": "vendor-acme",
    "irreversible": true,
    "creates_commitment": true
  },
  "principal": {
    "mandate": {
      "max_autonomous_amount": 25000,
      "human_approval_amount": 10000,
      "approval_action_types": ["change_vendor_bank_account"]
    }
  },
  "previous_state": {
    "vendor": { "bank_account": "RBC-8821", "email_domain": "acme.ca" }
  },
  "current_state": {
    "vendor": { "bank_account": "TD-7742", "email_domain": "acme.ca" }
  },
  "claims": [{
    "text": "ACME changed banks because of a corporate restructuring",
    "material": true,
    "evidence": [{ "source": "supplier email", "verified": true, "independent": false }]
  }]
}
```

Expected result: `VERIFY`, with a sensitive-state-change signal, an independent-evidence requirement and a principal-approval requirement.

## What v0.1 deliberately does not do

- no payment rail or x402 billing yet;
- no persistent trust/reputation graph;
- no external evidence retrieval;
- no model-based semantic challenge;
- no enterprise integrations;
- no consumer UI.

Those come only after the primitive proves useful.
