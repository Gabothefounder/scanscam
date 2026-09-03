"use client";

import { usePathname } from "next/navigation";
import ClientShell from "./ClientShell";
import Footer from "./Footer";
import CookieConsentBanner from "./CookieConsentBanner";

export default function ConditionalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isInternal = pathname?.startsWith("/internal");
  const isAtlas = pathname === "/atlas";

  if (isInternal) {
    return <>{children}</>;
  }

  if (isAtlas) {
    return (
      <>
        {children}
        <CookieConsentBanner />
      </>
    );
  }

  return (
    <ClientShell>
      <main style={{ paddingTop: "8px", flex: 1 }}>{children}</main>
      <Footer />
    </ClientShell>
  );
}
