export function resolveInsufficientContext(input: {
  refined: boolean;
  submissionRoute: string;
  contextQuality: string;
  semanticSufficiency?: "enough" | "insufficient";
}): boolean {
  if (input.refined) return false;

  if (input.submissionRoute === "insufficient_context") return true;
  if (input.contextQuality === "fragment") return true;

  return (
    input.semanticSufficiency === "insufficient" &&
    ["thin", "fragment", "unknown"].includes(input.contextQuality)
  );
}

export type PublicResultState = "classified" | "insufficient_context";

export function publicResultState(insufficient: boolean): PublicResultState {
  return insufficient ? "insufficient_context" : "classified";
}
