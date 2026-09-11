export type SignalRow = {
  scan_id: string;
  scam_family: string | null;
  authority_type: string | null;
  primary_request: string | null;
  tactic_tags: string[] | null;
  emotion_vectors: string[] | null;
};
export type ArchiveMetrics = {
  sampleSize: number;
  classified: number;
  unclassified: number;
  families: Record<string, number>;
  authorities: Record<string, number>;
  requests: Record<string, number>;
  pressure: Record<string, number>;
};
function valid(value: string | null): value is string {
  return Boolean(value && !["unknown", "none", "unclassified"].includes(value));
}
export function aggregateArchive(rows: SignalRow[]): ArchiveMetrics {
  const result: ArchiveMetrics = { sampleSize: 0, classified: 0, unclassified: 0, families: {}, authorities: {}, requests: {}, pressure: {} };
  const seen = new Set<string>();
  const add = (group: Record<string, number>, value: string | null) => {
    if (valid(value)) group[value] = (group[value] ?? 0) + 1;
  };
  for (const row of rows) {
    if (seen.has(row.scan_id)) continue;
    seen.add(row.scan_id);
    result.sampleSize++;
    if (valid(row.scam_family)) result.classified++;
    else result.unclassified++;
    add(result.families, row.scam_family);
    add(result.authorities, row.authority_type);
    add(result.requests, row.primary_request);
    // A feature present in both arrays still describes just one scan.
    for (const feature of new Set([...(row.tactic_tags ?? []), ...(row.emotion_vectors ?? [])])) add(result.pressure, feature);
  }
  return result;
}
type Page = { data: SignalRow[] | null; count: number | null; error: unknown };
export async function readCompleteArchive(readPage: (from: number, to: number) => PromiseLike<Page>) {
  const rows: SignalRow[] = [];
  let expected: number | null = null;
  do {
    const page = await readPage(rows.length, rows.length + 499);
    if (page.error || !page.data || page.count === null) throw new Error("Archive query unavailable");
    if (expected !== null && page.count !== expected) throw new Error("Archive changed during read");
    expected = page.count;
    if (!page.data.length && rows.length < expected) throw new Error("Incomplete Archive query");
    rows.push(...page.data);
  } while (rows.length < expected);
  const metrics = aggregateArchive(rows);
  if (metrics.sampleSize !== expected) throw new Error("Archive changed during read");
  return metrics;
}
