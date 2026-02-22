import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ClientShell from "@/app/components/ClientShell";
import Footer from "@/app/components/Footer";
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
        <ClientShell>
          <main style={{ paddingTop: "8px", flex: 1 }}>{children}</main>
          <Footer />
        </ClientShell>

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
