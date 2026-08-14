/**
 * Phase 0 Priority 2 regression: scans SoT vs temporary raw persistence.
 * Run: npx tsx scripts/verify-scan-persist-outcome.ts
 */

import { verifyScanPersistOutcome } from "../lib/scan/scanPersistOutcome";

verifyScanPersistOutcome();
console.log("verify-scan-persist-outcome: OK");
