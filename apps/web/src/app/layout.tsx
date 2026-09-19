import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import { TOKENS_CSS } from "@/lib/tokensCss";
import "./globals.css";

// The same four faces as the mobile app — see fontFamilies in @kelo/core.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: "700", variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
// Wordmark only — the "kelo." mark's typeface is part of the mark itself.
const wordmark = Space_Grotesk({ subsets: ["latin"], weight: "700", variable: "--font-wordmark", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kelo — verified, metered charging", template: "%s · Kelo" },
  description:
    "Kelo connects drivers with home chargers. Every session is billed from the charger's own meter reading, so what a driver pays and what a host earns is exactly the energy delivered.",
};

export const viewport: Viewport = { themeColor: "#12161C", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} ${wordmark.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: TOKENS_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
