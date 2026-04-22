import assert from "node:assert/strict";
import { applyArchetypeOverrides } from "@/lib/scan-analysis/applyArchetypeOverrides";
import { validateArchetypeOverrideConsistency } from "@/lib/scan-analysis/validateArchetypeOverrideConsistency";

type Fixture = {
  id: string;
  text: string;
  context: {
    context_quality: string;
    intel_state: string;
    input_type?: string;
    context_refined?: boolean;
  };
  intel: Record<string, unknown>;
  expectApplied?: boolean;
  expectReason?: string;
  expectFieldEquals?: Record<string, unknown>;
  expectValidatorFullRevert?: boolean;
};

const FIXTURES: Fixture[] = [
  {
    id: "government_penalty_positive",
    text: "Service Ontario notice: unpaid parking violation. Pay fine now to avoid plate denial.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown", intel_state: "weak_signal" },
    expectApplied: true,
    expectFieldEquals: { narrative_category: "government_impersonation" },
  },
  {
    id: "delivery_customs_positive",
    text: "DHL package on hold. Pay customs fee now and click link to release delivery.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: true,
    expectFieldEquals: { narrative_category: "delivery_scam" },
  },
  {
    id: "interac_positive",
    text: "Interac e-transfer pending deposit. Send money now to complete security hold.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown", authority_type: "unknown" },
    expectApplied: true,
    expectFieldEquals: { narrative_category: "financial_phishing" },
  },
  {
    id: "job_telegram_positive",
    text: "Recruiter asks you to move to Telegram and send a training deposit for payroll setup.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: true,
    expectFieldEquals: { narrative_category: "employment_scam" },
  },
  {
    id: "benign_delivery_negative",
    text: "Order confirmation: your package is out for delivery. Track your package here.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: false,
  },
  {
    id: "benign_interac_negative",
    text: "Thanks for dinner, I paid you back by Interac transfer.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: false,
  },
  {
    id: "meta_wrapper_with_scam_content",
    text: "is this fake? Service Ontario says pay this fine now or plate denied.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: true,
  },
  {
    id: "pure_meta_discussion_negative",
    text: "can you check this? is this fake?",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: { narrative_category: "unknown" },
    expectApplied: false,
    expectReason: "kill_meta_discussion",
  },
  {
    id: "weak_link_only_negative",
    text: "https://bit.ly/abc123",
    context: { context_quality: "fragment", intel_state: "weak_signal", input_type: "link_only" },
    intel: { narrative_category: "unknown" },
    expectApplied: false,
  },
  {
    id: "validator_full_revert",
    text: "DHL package on hold. Pay customs fee now.",
    context: { context_quality: "partial", intel_state: "weak_signal", input_type: "full_message" },
    intel: {
      narrative_category: "unknown",
      narrative_family: "unknown",
      authority_type: "government",
    },
    expectApplied: true,
    expectValidatorFullRevert: true,
  },
];

/**
 * Replay-friendly verification for local development.
 * Requires ENABLE_ARCHETYPE_OVERRIDES=true when executed.
 */
export function runArchetypeOverrideFixtureChecks(): void {
  for (const f of FIXTURES) {
    const out = applyArchetypeOverrides({
      intel: { ...f.intel },
      corpusLower: f.text.toLowerCase(),
      context: f.context,
      mode: "apply",
    });

    if (typeof f.expectApplied === "boolean") {
      assert.equal(out.applied, f.expectApplied, `${f.id}: applied mismatch`);
    }
    if (f.expectReason) {
      assert.equal(out.reason, f.expectReason, `${f.id}: reason mismatch`);
    }
    if (f.expectFieldEquals && out.applied) {
      for (const [k, v] of Object.entries(f.expectFieldEquals)) {
        assert.equal(out.intel[k], v, `${f.id}: field ${k} mismatch`);
      }
    }

    const validated = validateArchetypeOverrideConsistency({
      intel: out.intel,
      overrideMeta: out.overrideMeta,
    });
    if (f.expectValidatorFullRevert === true) {
      assert.equal(validated.fullRevert, true, `${f.id}: expected full validator revert`);
    }
  }
}

