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
  // Cyan used AS TEXT (links, small labels). The bright accent is fine as a
  // fill or decoration but far too light as text on a light background
  // (1.5:1 on #EDEEF0), so light mode uses a darkened variant. Dark mode has no
  // such problem and reuses the accent. Fills/decoration always use `cyan`.
  cyanText: string;
  text: string; // primary text
  textSoft: string; // secondary/muted text
  danger: string;
  // The danger colour as text (form errors). #E8846B is 2.3:1 on the light
  // background, which is unreadable for an error message; light mode darkens it.
  dangerText: string;
  field: string; // text-input fill
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
  cyanText: "#4FD8C4",
  text: "#EDEEF0",
  textSoft: "#8891A0",
  danger: "#E8846B",
  dangerText: "#E8846B",
  field: "#222A34",
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
  cyanText: "#0A6F5F", // website rule: readable cyan text is this darker variant (>= 4.66:1 on every surface it sits on; #0E8C79 was 3.2-3.6:1)
  text: "#12161C", // was Ink — now primary text
  textSoft: "#2C3540", // was Hair — now secondary text
  danger: "#E8846B",
  dangerText: "#B03A22",
  field: "#FFFFFF",
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

// The same mark on a LIGHT background (the website): the frame is a soft grey
// rather than the dark theme's near-black, and the outer nodes are hollow rings.
export const BRAND_MARK_LIGHT = {
  edge: "#8891A0",
  edgeOpacity: 0.5,
  signal: "#4FD8C4",
  ring: "#8891A0",
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
  display: { family: "Archivo", weight: 700 }, // headlines, card titles
  body: { family: "Public Sans", weight: 400 },
  bodyMedium: { family: "Public Sans", weight: 500 },
  mono: { family: "JetBrains Mono", weight: 400 }, // reserved for measured figures — kWh, rates, timers
  monoMedium: { family: "JetBrains Mono", weight: 500 },
  wordmark: { family: "Space Grotesk", weight: 700 },
} as const;

/**
 * Letter-spacing (tracking) in em, so it scales with type size on any
 * platform (mobile multiplies by its font size; web uses it directly).
 *
 * Derived from mobile's real usages of the display face rather than chosen
 * fresh: 8 call sites set -0.2px..-0.3px at 15-24px, i.e. -0.0105em to
 * -0.0136em, most commonly -0.0125em (24px / -0.3px, on four screens).
 * `wordmark` is the "kelo." mark's own value (15px / -0.2px).
 *
 * These are mobile's values (set when the display face was Bricolage Grotesque
 * and kept when it became Archivo). The website follows its own finished
 * mockups for headline tracking instead — see apps/web/src/app/globals.css.
 */
export const tracking = {
  display: -0.0125,
  wordmark: -0.0133,
} as const;
