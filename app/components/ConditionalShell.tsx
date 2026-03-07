"use client";

import { usePathname } from "next/navigation";
import ClientShell from "./ClientShell";
import Footer from "./Footer";

export default function ConditionalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isInternal = pathname?.startsWith("/internal");

  if (isInternal) {
    return <>{children}</>;
  }

  return (
    <ClientShell>
      <main style={{ paddingTop: "8px", flex: 1 }}>{children}</main>
      <Footer />
    </ClientShell>
  );
}
