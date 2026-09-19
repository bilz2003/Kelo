/**
 * Kelo design tokens for the mobile app.
 *
 * Colours, radii and spacing now live in @kelo/core (packages/core/src/
 * tokens.ts) — the single framework-agnostic source shared with apps/web.
 * They're re-exported here unchanged so every existing `@/theme/tokens`
 * import keeps working. Only `fonts` stays local: those strings are Expo
 * font-loading registrations (one family name per weight), which are a
 * React Native concern, not a shared design value.
 */

export { getTokens, FIXED, radii, spacing } from "@kelo/core";
export type { ThemeMode, ThemeTokens } from "@kelo/core";

// Space Grotesk (display) and IBM Plex Mono (mono) were retired from this
// object for the 2026-09 font system change — everything reading through
// `fonts` below now gets the new set. The two deliberate exceptions (the
// BrandMark wordmark and the Splash screen's "verified, metered charging"
// tagline) were moved to their own hardcoded fontFamily strings instead of
// being carved out here, specifically so they can never be silently pulled
// along by a future change to this object — see BrandMark in Controls.tsx
// and SplashScreen.tsx for those.
export const fonts = {
  display: "BricolageGrotesque_700Bold", // headlines, prices, big numbers
  body: "PublicSans_400Regular",
  bodyMedium: "PublicSans_500Medium",
  mono: "JetBrainsMono_400Regular", // reserved for measured figures — kWh, rates, timers
  monoMedium: "JetBrainsMono_500Medium",
};
