import { DARK_TOKENS, radii } from "@kelo/core";

/**
 * Emits @kelo/core's shared design tokens as CSS custom properties, so the
 * web stylesheet never carries its own copy of a colour or radius. The website
 * ships the brand's default (dark) palette only; mobile additionally offers
 * a light mode, which the shared tokens already support if the site wants it.
 */
export const TOKENS_CSS = `:root{
--ink:${DARK_TOKENS.ink};
--surface:${DARK_TOKENS.surface};
--surface2:${DARK_TOKENS.surface2};
--hair:${DARK_TOKENS.hair};
--cyan:${DARK_TOKENS.cyan};
--cyan-10:${DARK_TOKENS.cyanTint10};
--cyan-30:${DARK_TOKENS.cyanTint30};
--text:${DARK_TOKENS.text};
--text-soft:${DARK_TOKENS.textSoft};
--danger:${DARK_TOKENS.danger};
--on-accent:${DARK_TOKENS.onAccent};
--r-sm:${radii.sm}px;
--r-md:${radii.md}px;
--r-lg:${radii.lg}px;
--r-xl:${radii.xl}px;
--r-xxl:${radii.xxl}px;
}`;
