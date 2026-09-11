"use client";
import { useCallback, useEffect, useState } from "react";
import type { ArchiveMetrics } from "@/lib/atlasArchiveMetrics";
export type Metrics = ArchiveMetrics & { generatedAt: string };

export function useArchiveMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/atlas/archive", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (!data.ok || typeof data.sampleSize !== "number" || !data.families) throw new Error("unavailable");
        if (!controller.signal.aborted) { setMetrics(data); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [attempt]);
  return { metrics, failed, retry };
}
