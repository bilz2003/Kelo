/**
 * Kelo design tokens — framework-agnostic.
 *
 * The single source of truth for Kelo's colours, radii and spacing scale,
 * consumed by both apps/mobile (React Native) and apps/web (Next.js). Plain
 * values only — no React, no React Native, no CSS — so either can adapt them
 * to its own styling system (mobile passes them straight into StyleSheet
 * objects; web emits them as CSS custom properties).
 *
 * Ported directly from the original web prototype's brand system. Dark and
 * light share the exact same 8 brand colours — light mode only inverts which
 * role each one plays (background <-> text) and reuses the panel/border
 * colours as tints. Nothing new is introduced.
 *
 * Cyan is reserved strictly for verified / live / interactive elements. It is
 * never decorative — that rule is the point of the colour, on every surface.
 */

export type ThemeMode = "dark" | "light";

export interface ThemeTokens {
  ink: string; // page background
  surface: string; // card fill
  surface2: string; // nested card fill (avatars, chips)
  hair: string; // borders/dividers
  cyan: string; // Signal accent — verified/interactive/live, used consistently
  cyanTint10: string;
  cyanTint30: string;
  text: string; // primary text
  textSoft: string; // secondary/muted text
  danger: string;
  onAccent: string; // fixed dark ink, for text/icons on the cyan accent — same in both modes
}

export const DARK_TOKENS: ThemeTokens = {
  ink: "#12161C",
  surface: "#1A2029",
  surface2: "#222A34",
  hair: "#2C3540",
  cyan: "#4FD8C4",
  cyanTint10: "rgba(79,216,196,0.1)",
  cyanTint30: "rgba(79,216,196,0.3)",
  text: "#EDEEF0",
  textSoft: "#8891A0",
  danger: "#E8846B",
  onAccent: "#12161C",
};

export const LIGHT_TOKENS: ThemeTokens = {
  ink: "#EDEEF0", // was Text — now the page background
  surface: "rgba(26,32,41,0.035)",
  surface2: "rgba(34,42,52,0.065)",
  hair: "rgba(136,145,160,0.45)",
  cyan: "#4FD8C4",
  cyanTint10: "rgba(79,216,196,0.12)",
  cyanTint30: "rgba(79,216,196,0.35)",
  text: "#12161C", // was Ink — now primary text
  textSoft: "#2C3540", // was Hair — now secondary text
  danger: "#E8846B",
  onAccent: "#12161C",
};

export const getTokens = (mode: ThemeMode): ThemeTokens => (mode === "light" ? LIGHT_TOKENS : DARK_TOKENS);

// Fixed values that never flip with theme — device chrome / logo artwork.
export const FIXED = {
  splashBackground: DARK_TOKENS.ink,
};

// The network-node logo mark's own artwork colours. Constant in both themes:
// a logo doesn't participate in the light/dark flip.
export const BRAND_MARK = {
  edge: "#2C3540",
  signal: "#4FD8C4",
  nodeFill: "#222A34",
};

// Radii in px. Same scale on both platforms.
export const radii = { sm: 8, md: 10, lg: 12, xl: 14, xxl: 20, pill: 999 };

// 4px base unit.
export const spacing = (n: number) => n * 4;

/**
 * Typeface families and weights, by role — platform-neutral names. Each
 * platform maps these onto its own font-loading mechanism (web: next/font;
 * mobile: expo-font, which registers per-weight family strings such as
 * "BricolageGrotesque_700Bold" — see apps/mobile/src/theme/tokens.ts).
 *
 * `wordmark` is deliberately separate from `display`: the "kelo." wordmark's
 * typeface is part of the brand mark itself and must not move if the display
 * face ever changes.
 */
export const fontFamilies = {
  display: { family: "Bricolage Grotesque", weight: 700 }, // headlines, prices, big numbers
  body: { family: "Public Sans", weight: 400 },
  bodyMedium: { family: "Public Sans", weight: 500 },
  mono: { family: "JetBrains Mono", weight: 400 }, // reserved for measured figures — kWh, rates, timers
  monoMedium: { family: "JetBrains Mono", weight: 500 },
  wordmark: { family: "Space Grotesk", weight: 700 },
} as const;
