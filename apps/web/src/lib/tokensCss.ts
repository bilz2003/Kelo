import { LIGHT_TOKENS, radii, tracking } from "@kelo/core";

/**
 * Emits @kelo/core's shared design tokens as CSS custom properties, so the web
 * stylesheet never carries its own copy of a colour or radius.
 *
 * The website is LIGHT-mode only — deliberately different from the mobile
 * app's dark default. `--cyan-text` is the darkened cyan used wherever cyan is
 * TEXT (links, small labels); `--cyan` (the bright accent) is for fills and
 * decoration only. `--danger-text` is the same idea for error messages.
 */
export const TOKENS_CSS = `:root{
--ink:${LIGHT_TOKENS.ink};
--surface:${LIGHT_TOKENS.surface};
--surface2:${LIGHT_TOKENS.surface2};
--hair:${LIGHT_TOKENS.hair};
--cyan:${LIGHT_TOKENS.cyan};
--cyan-10:${LIGHT_TOKENS.cyanTint10};
--cyan-30:${LIGHT_TOKENS.cyanTint30};
--cyan-text:${LIGHT_TOKENS.cyanText};
--text:${LIGHT_TOKENS.text};
--text-soft:${LIGHT_TOKENS.textSoft};
--danger:${LIGHT_TOKENS.danger};
--danger-text:${LIGHT_TOKENS.dangerText};
--field:${LIGHT_TOKENS.field};
--on-accent:${LIGHT_TOKENS.onAccent};
--r-sm:${radii.sm}px;
--r-md:${radii.md}px;
--r-lg:${radii.lg}px;
--r-xl:${radii.xl}px;
--r-xxl:${radii.xxl}px;
--tracking-display:${tracking.display}em;
--tracking-wordmark:${tracking.wordmark}em;
}`;
