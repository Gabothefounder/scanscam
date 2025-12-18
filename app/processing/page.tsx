import { Suspense } from "react";
import ProcessingInner from "./processing-inner";

export const dynamic = "force-dynamic";

export default function ProcessingPage() {
  return (
    <Suspense fallback={null}>
      <ProcessingInner />
    </Suspense>
  );
}
