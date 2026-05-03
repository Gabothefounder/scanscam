/**
 * Shallow-merge report_feedback into existing report_snapshot JSON without dropping other keys.
 */
export function mergeReportFeedbackIntoSnapshot(
  existing: unknown,
  reportFeedback: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  base.report_feedback = reportFeedback;
  return base;
}
