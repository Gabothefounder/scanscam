/**
 * Shareable ScanScam Decision Report — /r/{token}
 *
 * TODO (Phase 3C+): Look up `pro_report_access` by `access_token` using the service-role
 * Supabase client (same pattern as `app/msp/view/[token]/page.tsx`). Reject if `expires_at`
 * is in the past. Load the scan by `scan_id`, then render the Decision Report from
 * `intel_features` / scan fields (mirror `/pro` structure without query-param telemetry).
 *
 * -----------------------------------------------------------------------------
 * PROPOSED SQL (review & run manually — do not assume this table exists)
 * -----------------------------------------------------------------------------
 *
 * create table if not exists public.pro_report_access (
 *   id uuid primary key default gen_random_uuid(),
 *   scan_id uuid not null references public.scans(id) on delete cascade,
 *   access_token text not null unique,
 *   created_at timestamptz not null default now(),
 *   expires_at timestamptz not null,
 *   report_kind text not null default 'decision_report',
 *   report_snapshot jsonb null
 * );
 *
 * create index if not exists pro_report_access_token_idx
 *   on public.pro_report_access (access_token);
 *
 * create index if not exists pro_report_access_expires_idx
 *   on public.pro_report_access (expires_at);
 *
 * -- RLS: enable, then add policies so anon/authenticated clients cannot read/write
 * -- the table directly; only the Next.js server route (service role) performs selects
 * -- by token + expiry and inserts new rows. Example outline:
 * --
 * -- alter table public.pro_report_access enable row level security;
 * -- (no policy for anon → no direct access; service role bypasses RLS for server code.)
 *
 * -----------------------------------------------------------------------------
 */

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharedReportTokenPage({ params }: PageProps) {
  await params;

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Shareable report route coming soon</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Secure 21-day links will open the full decision report here. Token lookup and rendering
        are not wired yet.
      </p>
    </main>
  );
}
