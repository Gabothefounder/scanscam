/**
 * Phase 0 Priority 2 — canonical scan vs temporary raw persistence outcomes.
 *
 * persisted / scan_persisted = structured observation written to `scans` (SoT).
 * raw_persisted = temporary raw artifact in `raw_messages` (optional; not required for ThreatRecord).
 *
 * Failure to write raw must never invalidate a successful scans row.
 */

export type ScanPersistOutcome = {
  /** Canonical observation exists in `scans`. API field name remains `persisted`. */
  persisted: boolean;
  scan_id: string | null;
  /** Temporary raw retention succeeded when attempted; false if failed or not attempted. */
  raw_persisted: boolean;
  /** Stable category for ops (never raw DB message text). */
  scan_persist_error_code: "insert_failed" | null;
  raw_persist_error_code: "insert_failed" | "skipped_no_scan" | "not_requested" | null;
};

export type BuildScanPersistOutcomeInput = {
  scanInsertOk: boolean;
  scanId: string | null;
  /** Whether this request intended to write raw_messages (raw_opt_in && !refined). */
  rawWriteRequested: boolean;
  rawInsertOk: boolean | null;
};

export function buildScanPersistOutcome(input: BuildScanPersistOutcomeInput): ScanPersistOutcome {
  const scanId =
    input.scanInsertOk && typeof input.scanId === "string" && input.scanId.trim().length > 0
      ? input.scanId.trim()
      : null;
  const persisted = Boolean(scanId);

  if (!persisted) {
    return {
      persisted: false,
      scan_id: null,
      raw_persisted: false,
      scan_persist_error_code: input.scanInsertOk ? null : "insert_failed",
      raw_persist_error_code: input.rawWriteRequested ? "skipped_no_scan" : "not_requested",
    };
  }

  if (!input.rawWriteRequested) {
    return {
      persisted: true,
      scan_id: scanId,
      raw_persisted: false,
      scan_persist_error_code: null,
      raw_persist_error_code: "not_requested",
    };
  }

  if (input.rawInsertOk === true) {
    return {
      persisted: true,
      scan_id: scanId,
      raw_persisted: true,
      scan_persist_error_code: null,
      raw_persist_error_code: null,
    };
  }

  return {
    persisted: true,
    scan_id: scanId,
    raw_persisted: false,
    scan_persist_error_code: null,
    raw_persist_error_code: "insert_failed",
  };
}

export function verifyScanPersistOutcome(): void {
  const a = buildScanPersistOutcome({
    scanInsertOk: false,
    scanId: null,
    rawWriteRequested: true,
    rawInsertOk: null,
  });
  if (a.persisted !== false || a.scan_id !== null || a.raw_persisted !== false) {
    throw new Error("A: scans failure must clear scan and raw");
  }
  if (a.scan_persist_error_code !== "insert_failed") throw new Error("A: scan error code");
  if (a.raw_persist_error_code !== "skipped_no_scan") throw new Error("A: raw skipped");

  const b = buildScanPersistOutcome({
    scanInsertOk: true,
    scanId: "11111111-1111-4111-8111-111111111111",
    rawWriteRequested: true,
    rawInsertOk: false,
  });
  if (b.persisted !== true || b.scan_id == null) throw new Error("B: scan must remain");
  if (b.raw_persisted !== false) throw new Error("B: raw_persisted false");
  if (b.raw_persist_error_code !== "insert_failed") throw new Error("B: raw error code");

  const c = buildScanPersistOutcome({
    scanInsertOk: true,
    scanId: "11111111-1111-4111-8111-111111111111",
    rawWriteRequested: true,
    rawInsertOk: true,
  });
  if (c.persisted !== true || c.raw_persisted !== true) throw new Error("C: both persisted");
  if (c.scan_persist_error_code !== null || c.raw_persist_error_code !== null) {
    throw new Error("C: no error codes");
  }
}
