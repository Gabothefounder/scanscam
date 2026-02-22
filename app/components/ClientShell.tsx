"use client";

import Header from "./Header";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <Header />
      {children}
    </div>
  );
}
