"use client";

import { Suspense } from "react";
import ProcessingInner from "./processing-inner";

export default function ProcessingPage() {
  return (
    <Suspense fallback={null}>
      <ProcessingInner />
    </Suspense>
  );
}
