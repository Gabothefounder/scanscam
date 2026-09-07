import { notFound } from "next/navigation";
import AgentLabClient from "./AgentLabClient";

export const dynamic = "force-dynamic";

export default function AgentLabPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <AgentLabClient />;
}
