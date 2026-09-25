import type { Metadata, Viewport } from "next";
import { TOKENS_CSS } from "@/lib/tokensCss";
import { body, display, mono, wordmark } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kelo — verified, metered charging", template: "%s · Kelo" },
  description:
    "Kelo connects drivers with home chargers. Every session is billed from the charger's own meter reading, so what a driver pays and what a host earns is exactly the energy delivered.",
};

export const viewport: Viewport = { themeColor: "#EDEEF0", colorScheme: "light" };

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
