import type { OverrideMetaV1 } from "@/lib/scan-analysis/applyArchetypeOverrides";

type ValidateInput = {
  intel: Record<string, unknown>;
  overrideMeta?: OverrideMetaV1;
};

type ValidateOutput = {
  intel: Record<string, unknown>;
  overrideMeta?: OverrideMetaV1;
  partialRollback: boolean;
  fullRevert: boolean;
};

export function validateArchetypeOverrideConsistency(input: ValidateInput): ValidateOutput {
  if (!input.overrideMeta?.override_applied) {
    return { intel: input.intel, overrideMeta: input.overrideMeta, partialRollback: false, fullRevert: false };
  }

  const original = input.overrideMeta;
  const nextIntel = { ...input.intel };
  const changed = [...original.override_fields_changed];
  const revertedFields: string[] = [];
  let reasons = detectContradictions(nextIntel);

  // Prefer conservative rollback of recently changed override fields first.
  for (let i = changed.length - 1; i >= 0 && reasons.length > 0; i--) {
    const field = changed[i];
    if (!(field in original.override_before_snapshot)) continue;
    nextIntel[field] = original.override_before_snapshot[field];
    revertedFields.push(field);
    reasons = detectContradictions(nextIntel);
  }

  if (reasons.length === 0) {
    if (revertedFields.length === 0) {
      return { intel: nextIntel, overrideMeta: original, partialRollback: false, fullRevert: false };
    }
    const updatedMeta: OverrideMetaV1 = {
      ...original,
      override_reverted: true,
      override_reverted_reason: "partial_rollback:" + "resolved_contradiction",
      override_reverted_fields: revertedFields,
      override_after_snapshot: buildSnapshot(nextIntel, original.override_fields_changed),
    };
    return { intel: nextIntel, overrideMeta: updatedMeta, partialRollback: true, fullRevert: false };
  }

  // If contradictions persist, revert entire override payload.
  const fullyReverted = { ...input.intel };
  for (const field of changed) {
    if (field in original.override_before_snapshot) {
      fullyReverted[field] = original.override_before_snapshot[field];
    }
  }

  const finalMeta: OverrideMetaV1 = {
    ...original,
    override_reverted: true,
    override_reverted_reason: "full_revert_unresolved_contradiction",
    override_reverted_fields: changed,
    override_after_snapshot: buildSnapshot(fullyReverted, original.override_fields_changed),
  };

  return { intel: fullyReverted, overrideMeta: finalMeta, partialRollback: false, fullRevert: true };
}

function detectContradictions(intel: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  const authority = String(intel.authority_type ?? "unknown");
  const narrativeCategory = String(intel.narrative_category ?? "unknown");
  const narrativeFamily = String(intel.narrative_family ?? "unknown");
  const paymentIntent = String(intel.payment_intent ?? "unknown");
  const requestedAction = String(intel.requested_action ?? "unknown");
  const intelState = String(intel.intel_state ?? "unknown");
  const contextQuality = String(intel.context_quality ?? "unknown");
  const submissionRoute = String(intel.submission_route ?? "unknown");
  const inputType = String(intel.input_type ?? "unknown");
  const contextRefined = intel.context_refined === true;

  const deliveryLike =
    narrativeCategory === "delivery_scam" || narrativeFamily === "delivery_scam";
  const governmentLike =
    narrativeCategory === "government_impersonation" || narrativeFamily === "government_impersonation";

  if (authority === "government" && deliveryLike) {
    reasons.push("authority_government_with_delivery_narrative");
  }

  if ((authority === "logistics" || authority === "courier") && governmentLike) {
    reasons.push("authority_courier_with_government_narrative");
  }

  const paymentSet = paymentIntent !== "unknown" && paymentIntent !== "none" && paymentIntent !== "";
  const actionMissing = requestedAction === "unknown" || requestedAction === "none" || requestedAction === "";
  if (paymentSet && actionMissing) {
    reasons.push("payment_intent_without_requested_action");
  }

  const weakContext = contextQuality === "fragment" || contextQuality === "unknown";
  const insufficientLike = submissionRoute === "insufficient_context";
  const linkOnlyUnrefined = inputType === "link_only" && !contextRefined;
  if (intelState === "structured_signal" && (weakContext || insufficientLike || linkOnlyUnrefined)) {
    reasons.push("structured_signal_on_weak_context");
  }

  return reasons;
}

function buildSnapshot(intel: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f] = intel[f];
  return out;
}
