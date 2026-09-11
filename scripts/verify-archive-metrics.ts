import assert from "node:assert/strict";
import { readCompleteArchive, aggregateArchive, type SignalRow } from "../lib/atlasArchiveMetrics";

const row = (id: number): SignalRow => ({ scan_id: String(id), scam_family: id % 2 ? "account_verification" : null, authority_type: "government", primary_request: "click_link", tactic_tags: ["urgency", "urgency"], emotion_vectors: ["urgency"] });
async function main() {
  const rows = Array.from({ length: 1391 }, (_, i) => row(i));
  const pages: number[] = [];
  // Simulate a server cap lower than the requested range, too.
  const result = await readCompleteArchive(async (from, to) => {
    pages.push(from);
    return { data: rows.slice(from, Math.min(to + 1, from + 300)), count: rows.length, error: null };
  });
  assert.equal(result.sampleSize, 1391);
  assert.equal(result.classified, 695);
  assert.equal(result.unclassified, 696);
  assert.equal(result.pressure.urgency, 1391);
  assert.equal(result.families.government, undefined);
  assert.equal(result.authorities.government, 1391);
  assert.deepEqual(pages, [0, 300, 600, 900, 1200]);
  assert.equal(aggregateArchive([row(1), row(1)]).sampleSize, 1);
  assert.equal((await readCompleteArchive(async () => ({ data: [], count: 0, error: null }))).sampleSize, 0);
  await assert.rejects(readCompleteArchive(async () => ({ data: [], count: null, error: new Error("database unavailable") })));
  await assert.rejects(readCompleteArchive(async () => ({ data: [], count: 100, error: null })));
  await assert.rejects(readCompleteArchive(async from => ({ data: [row(from)], count: from ? 3 : 2, error: null })));
  await assert.rejects(readCompleteArchive(async () => ({ data: [row(1), row(1)], count: 2, error: null })));
  console.log("Archive metrics passed: full pagination, lower server caps, distinct features, separate dimensions, zero, incomplete reads, changing data and errors.");
}
main();
