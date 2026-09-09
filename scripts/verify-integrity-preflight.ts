import assert from "node:assert/strict";
import { preflight, type DecisionCapsule } from "../lib/integrity/preflight";

const safeRecurringPayment: DecisionCapsule = {
  proposed_action: { type: "send_payment", amount: 120, currency: "CAD", counterparty_id: "vendor-acme" },
  principal: { mandate: { max_autonomous_amount: 500 } },
  previous_state: { vendor: { bank_account: "RBC-8821", amount: 120 } },
  current_state: { vendor: { bank_account: "RBC-8821", amount: 120 } },
  claims: [],
};

assert.equal(preflight(safeRecurringPayment).decision, "ALLOW");

const bankChange: DecisionCapsule = {
  goal: "Pay the normal ACME invoice",
  proposed_action: {
    type: "change_vendor_bank_account",
    amount: 14_300,
    currency: "CAD",
    counterparty_id: "vendor-acme",
    irreversible: true,
    creates_commitment: true,
  },
  principal: {
    mandate: {
      max_autonomous_amount: 25_000,
      human_approval_amount: 10_000,
      approval_action_types: ["change_vendor_bank_account"],
    },
  },
  previous_state: { vendor: { bank_account: "RBC-8821", email_domain: "acme.ca" } },
  current_state: { vendor: { bank_account: "TD-7742", email_domain: "acme.ca" } },
  claims: [{
    text: "ACME changed banks because of a corporate restructuring",
    material: true,
    evidence: [{ source: "supplier email", verified: true, independent: false }],
  }],
};

const changed = preflight(bankChange);
assert.equal(changed.decision, "VERIFY");
assert(changed.signals.some((signal) => signal.code === "SENSITIVE_STATE_CHANGE"));
assert(changed.signals.some((signal) => signal.code === "MATERIAL_CLAIM_NOT_INDEPENDENTLY_VERIFIED"));
assert(changed.required_controls.includes("independent_evidence"));
assert(changed.required_controls.includes("verify_material_change"));
assert(changed.required_controls.includes("principal_approval"));

const blocked = preflight({
  proposed_action: { type: "transfer_funds", amount: 50_000, creates_commitment: true },
  principal: { mandate: { max_autonomous_amount: 5_000, blocked_action_types: ["transfer_funds"] } },
});
assert.equal(blocked.decision, "BLOCK");

const fee = preflight({
  proposed_action: {
    type: "accept_fee",
    amount: 475,
    creates_commitment: true,
    counterparty_id: "airline-agent",
  },
  principal: { mandate: { max_autonomous_amount: 1_000 } },
  previous_state: { booking: { cancellation_fee: 0 } },
  current_state: { booking: { cancellation_fee: 475 } },
  claims: [{ text: "A $475 cancellation fee applies", material: true, evidence: [] }],
});
assert.equal(fee.decision, "VERIFY");
assert(fee.signals.some((signal) => signal.code === "COMMITMENT_SCOPE_UNCLEAR"));

console.log("ScanScam Integrity preflight v0.1 invariants: PASS");
