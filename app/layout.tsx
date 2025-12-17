import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientShell from "@/app/components/ClientShell";
import "./globals.css";

/* ---------------- Fonts ---------------- */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ---------------- Metadata ---------------- */

export const metadata: Metadata = {
  title: "ScanScam — Check messages for scam warning signs",
  description:
    "Scan suspicious messages or screenshots to spot common scam warning signs. Anonymous, fast, and free.",
};

/* ---------------- Root Layout ---------------- */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, background: "#F7F8FA" }}
      >
        <ClientShell>
          <main style={{ paddingTop: "8px" }}>{children}</main>
        </ClientShell>
      </body>
    </html>
  );
}
