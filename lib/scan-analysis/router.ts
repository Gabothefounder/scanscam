/**
 * Top-level submission routing.
 * Routes to: likely_scam | likely_legit | ambiguous | test | insufficient_context
 */

import type { SubmissionRoute } from "./taxonomy";

export type RouterInput = {
  messageText: string;
  urlOnly: boolean;
  veryShort: boolean;
};

export function routeSubmission(input: RouterInput): SubmissionRoute {
  const { messageText, urlOnly, veryShort } = input;

  if (urlOnly) return "insufficient_context";

  const trimmed = messageText.trim();
  if (trimmed.length < 60) return "insufficient_context";

  const testStrings = ["test", "sample", "example"];
  const lower = trimmed.toLowerCase();
  if (testStrings.some((s) => lower.includes(s))) return "test";

  return "ambiguous";
}
