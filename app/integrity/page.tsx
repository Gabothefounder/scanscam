export const metadata = {
  title: "ScanScam Integrity — Agent Integration",
  description:
    "Experimental MCP preflight bolt-on for consequential autonomous-agent actions.",
};

const tools = [
  {
    name: "integrity_preflight",
    description:
      "Evaluate an independently observed consequential action before execution.",
  },
  {
    name: "integrity_retry_challenge",
    description:
      "Retry an open challenge after independent verifier evidence is available.",
  },
  {
    name: "integrity_commit",
    description:
      "Record the exact outcome of an action previously authorized by Guardian.",
  },
];

export default function IntegrityIntegrationPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          ScanScam Integrity · Experimental
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Independent preflight for agent actions.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          A bolt-on MCP service that checks consequential change, mandate boundaries,
          independent verification, commitments, and user values before an autonomous
          agent crosses an execution boundary.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/integrity/demo"
            className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Open demo
          </a>
          <a
            href="/api/integrity/v1/info"
            className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200"
          >
            Machine-readable JSON
          </a>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">MCP endpoint</p>
            <code className="mt-3 block break-all text-sm text-cyan-200">
              https://www.scanscam.ca/api/integrity/v1/mcp
            </code>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Streamable HTTP. Requires a ScanScam actor credential.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Decisions</p>
            <p className="mt-3 font-mono text-sm text-slate-200">
              ALLOW · CHALLENGE · APPROVAL_REQUIRED · DENY
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              ALLOW is action-bound. A different action requires a new preflight.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Tools</h2>
          <div className="mt-5 divide-y divide-slate-800">
            {tools.map((tool) => (
              <div key={tool.name} className="py-4">
                <code className="text-sm text-cyan-200">{tool.name}</code>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Required trust boundaries</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <li>Principal mandate defines what the agent is authorized to do.</li>
              <li>Independent observer creates the action observation.</li>
              <li>Actor cannot manufacture its own independent evidence.</li>
              <li>Verifier evidence is separate from the claim being verified.</li>
              <li>Commit settles the exact authorized execution outcome.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Current limits</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <li>Experimental release, not a production assurance certification.</li>
              <li>Not unbypassable unless integrated into an enforced execution path.</li>
              <li>No self-serve credential issuance yet.</li>
              <li>No real-money production transaction benchmark claimed.</li>
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Current evidence</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-semibold">20/20</p>
              <p className="mt-1 text-sm text-slate-500">external-agent benchmark decisions</p>
            </div>
            <div>
              <p className="text-3xl font-semibold">0</p>
              <p className="mt-1 text-sm text-slate-500">dangerous false ALLOWs in that sample</p>
            </div>
            <div>
              <p className="text-3xl font-semibold">8/8</p>
              <p className="mt-1 text-sm text-slate-500">exact ALLOW Commit paths</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Integration access</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This release does not issue credentials automatically. For an experimental
            integration, contact{" "}
            <a className="text-cyan-200 underline" href="mailto:hello@scanscam.ca">
              hello@scanscam.ca
            </a>.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Usage monitoring records connection/tool metadata only. It does not copy MCP
            tool arguments, transaction contents, raw observations, or verifier evidence
            into the monitoring event.
          </p>
        </section>
      </div>
    </main>
  );
}
