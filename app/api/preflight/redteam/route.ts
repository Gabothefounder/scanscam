import { runRedTeam } from "@/lib/integrity/redteam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(runRedTeam(), {
    headers: {
      "Cache-Control": "no-store",
      "X-ScanScam-RedTeam-Version": "0.1",
    },
  });
}
