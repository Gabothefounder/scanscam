/**
 * Three-way sales / preview intent from URL params (aligned with Phase 5 plan).
 * Used by /pro.
 */
export type SalesIntentBucket = "link" | "full_message" | "insufficient";

export function getSalesIntentFromParams(params: {
  input_type: string;
  intel_state: string;
  reason: string;
}): SalesIntentBucket {
  const intel = params.intel_state.trim().toLowerCase();
  const reason = params.reason.trim().toLowerCase();
  if (intel === "insufficient_context" || reason === "insufficient_context") {
    return "insufficient";
  }
  if (params.input_type.trim() === "full_message") {
    return "full_message";
  }
  return "link";
}
