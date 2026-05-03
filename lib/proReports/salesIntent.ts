/**
 * Three-way sales / preview intent from URL params (aligned with Phase 5 plan).
 * Used by /pro; ResultView bridges map copyVariant → same three paragraphs.
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

/** Map Pro CTA card variant to proBridge copy key (unsafe + link_only → link_only bridge). */
export type ProBridgeParagraphKey = "link_only" | "full_message" | "insufficient_context";

export function getProBridgeKeyFromCopyVariant(
  copyVariant: "unsafe" | "full_message" | "insufficient_context" | "link_only"
): ProBridgeParagraphKey {
  if (copyVariant === "full_message") return "full_message";
  if (copyVariant === "insufficient_context") return "insufficient_context";
  return "link_only";
}
