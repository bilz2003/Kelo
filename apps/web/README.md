# apps/web

Kelo's public marketing site and host self-service dashboard. Next.js (App Router, TypeScript).
Part of the monorepo described in the [root README](../../README.md).

## What's here — and what deliberately isn't

| Area | Routes |
|---|---|
| Marketing (public) | `/` — one page: hero, problem, how it works, drivers/hosts, earnings estimator, one account. (`/hosts` and `/metering` redirect to its `#hosts` / `#how-it-works` sections.) |
| Auth | `/login`, `/register` (First name, Last name, Email, Confirm email, Password, Confirm password) |
| Dashboard (signed in) | `/dashboard` (My chargers, availability), `/dashboard/chargers/[id]` (edit details + photos, remove), `/dashboard/earnings` |

**Not on the website, by design:** booking, Discover, live sessions, and *Add Charger* (adding a
charger needs the connection/verification flow, which lives in the mobile app). Don't add these here.

## Running it

```bash
cp .env.example .env.local        # KELO_API_URL=http://localhost:3000
npx next dev -p 3001              # or: npx next build && npx next start -p 3001
```

The backend (`apps/backend`) must be running. The site talks to it **only from the server**.

## Auth: a backend-for-frontend over the shared account system

The website has no account store of its own. Login and registration call the same backend
`/auth/login` and `/auth/register` the mobile app uses — same `User` table, same database.

- **Tokens never reach client JS.** Route Handlers under `src/app/api/auth/*` call the backend
  server-side and set the returned tokens as `httpOnly`, `Secure`, `SameSite=Lax` cookies. The
  response bodies contain the user, never a token.
  - `SameSite=Lax` (not `Strict`) so a signed-in host following a link from elsewhere isn't shown
    as logged out; cross-site POSTs still don't carry the cookie, and every mutating route
    additionally rejects a foreign `Origin` (`src/lib/origin.ts`).
  - The refresh token cookie is scoped to `path=/api`, so page requests never carry it.
- **Registration source.** The register handler injects `createdVia: "web"` server-side; the
  browser can't supply it (only name, email and password are forwarded).
- **Refresh on expiry** mirrors the mobile client (`apps/mobile/src/api/client.ts`), server-side:
  - Route Handlers (`src/lib/bff.ts`): attach the access token; on a 401 or a missing token,
    refresh once and retry; write the rotated pair back as cookies.
  - Server Components can't set cookies, and a refresh *rotates* the refresh token — so they
    never refresh in place. An expired session redirects through `GET /api/auth/refresh`, which
    renews the cookies and returns to the same page (`src/lib/serverApi.ts`, `src/proxy.ts`).
  - The backend treats a reused refresh token as theft and revokes every session, and a browser
    fires parallel requests. `src/lib/refresh.ts` therefore collapses concurrent refreshes of the
    same token into one, and briefly remembers the result — the same idea as mobile's
    single in-flight refresh.
  - That de-duplication is **per Node process**. A multi-instance deployment needs sticky routing
    or a shared store for it.

## Photo uploads

The existing S3 presigned-URL flow, run server-side: the browser posts a plain file input to
`/api/chargers/photos`; the server asks the backend for a presigned URL and `PUT`s the bytes to S3.
The private bucket needs no CORS configuration because the browser never talks to S3 for uploads.

## Design

The website is **light-mode only**, deliberately different from the mobile app's dark default. It was built
from three finished HTML mockups (homepage, log in, sign up) — the pages match them pixel-for-pixel at
1440/900/600/480/390 px — and the dashboard, which was never mocked, follows the same language.

- **Tokens** come from `@kelo/core` (`LIGHT_TOKENS`), emitted as CSS variables in `src/lib/tokensCss.ts`;
  `globals.css` holds no colour values of its own.
- **Cyan has two roles.** Bright `#4FD8C4` is for fills and decoration (buttons, the network pattern, switch
  thumbs). Cyan as readable *text* (links, small labels) is the darker `--cyan-text` (`cyanText`, `#0A6F5F`),
  which measures 4.66:1 or better on every surface it sits on (WCAG AA for small text). Error text uses
  `--danger-text` (`#B03A22`) because the coral `danger` fill is ~2.3:1 on this background.
- **Fonts:** Archivo 700 (headlines, card titles), Public Sans (body and section headings), JetBrains Mono
  (figures, small labels), Space Grotesk 700 (the "kelo." wordmark only). They load via `src/lib/fonts.ts`,
  which asserts them against `@kelo/core`'s `fontFamilies`, so the site can't drift from the app.
- **The animated network** (`components/NetworkBackground.tsx`): on the homepage it's three layers moved at
  different rates by scroll (`HeroParallax`); on log in / sign up it's the same layers as a fixed background
  with continuous pulse and data-flow animation. Both are switched off under `prefers-reduced-motion`.
- **Content rules (public pages):** no testimonials, customer logos or user counts (none exist), and Kelo's
  commission figure is never displayed. The earnings estimator shows only the host's take-home figure; its
  share is derived from the same commission constant the backend prices sessions with.

Homepage copy is **first-draft**. "Download Kelo" is a placeholder link — no store listing exists yet.
