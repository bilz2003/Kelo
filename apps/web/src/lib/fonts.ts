import { Archivo, JetBrains_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import { fontFamilies } from "@kelo/core";

// The same four faces as the mobile app. next/font needs its options as
// literals (it reads them at build time), so these can't be *derived* from
// @kelo/core's fontFamilies — instead they're loaded here and then ASSERTED
// against it below. If a font token in core changes and this file doesn't,
// the build fails rather than the site quietly drifting from the app.
export const display = Archivo({ subsets: ["latin"], weight: "700", variable: "--font-display", display: "swap" });
export const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
// Wordmark only — the "kelo." mark's typeface is part of the mark itself.
export const wordmark = Space_Grotesk({ subsets: ["latin"], weight: "700", variable: "--font-wordmark", display: "swap" });

interface Loaded {
  style: { fontFamily: string; fontWeight?: number | string };
}
function assertMatchesToken(role: string, loaded: Loaded, token: { family: string; weight: number }, singleWeight: boolean) {
  if (!loaded.style.fontFamily.includes(`'${token.family}'`)) {
    throw new Error(`Font mismatch for "${role}": web loads ${loaded.style.fontFamily}, @kelo/core fontFamilies.${role} says "${token.family}".`);
  }
  // A single-weight load reports its weight; multi-weight loads (body/mono)
  // don't, and are covered by the family check.
  if (singleWeight && Number(loaded.style.fontWeight) !== token.weight) {
    throw new Error(`Font weight mismatch for "${role}": web loads ${loaded.style.fontWeight}, @kelo/core says ${token.weight}.`);
  }
}
assertMatchesToken("display", display, fontFamilies.display, true);
assertMatchesToken("body", body, fontFamilies.body, false);
assertMatchesToken("mono", mono, fontFamilies.mono, false);
assertMatchesToken("wordmark", wordmark, fontFamilies.wordmark, true);
