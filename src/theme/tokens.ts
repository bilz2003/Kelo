/**
 * Kelo design tokens.
 *
 * Ported directly from the web prototype's brand system. Dark and light
 * share the exact same 8 brand colours — light mode only inverts which
 * role each one plays (background <-> text) and reuses the panel/border
 * colours as tints. Nothing new is introduced, same as the web version.
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

const DARK: ThemeTokens = {
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

const LIGHT: ThemeTokens = {
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

export const getTokens = (mode: ThemeMode): ThemeTokens => (mode === "light" ? LIGHT : DARK);

// Fixed values that never flip with theme — device chrome / logo artwork,
// same reasoning as the web version (the phone bezel and the mark itself
// don't participate in the light/dark flip).
export const FIXED = {
  splashBackground: DARK.ink,
};

export const fonts = {
  display: "SpaceGrotesk_700Bold", // headlines, prices, big numbers
  body: "IBMPlexSans_400Regular",
  bodyMedium: "IBMPlexSans_500Medium",
  mono: "IBMPlexMono_400Regular", // reserved for measured figures — kWh, rates, timers
  monoMedium: "IBMPlexMono_500Medium",
};

export const radii = { sm: 8, md: 10, lg: 12, xl: 14, xxl: 20, pill: 999 };
export const spacing = (n: number) => n * 4;
