import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ConditionalShell from "@/app/components/ConditionalShell";
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
        style={{ margin: 0, background: "#E2E4E9", minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <ConditionalShell>{children}</ConditionalShell>

        {/* Google Ads Global Site Tag */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-16787240010"
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-16787240010');
          `}
        </Script>
      </body>
    </html>
  );
}
