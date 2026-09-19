# apps/web

Kelo's public marketing site and host self-service dashboard. Next.js (App Router, TypeScript).
Part of the monorepo described in the [root README](../../README.md).

## What's here — and what deliberately isn't

| Area | Routes |
|---|---|
| Marketing (public) | `/`, `/metering`, `/hosts` |
| Auth | `/login`, `/register` |
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

Colours, radii and typeface roles come from `@kelo/core`'s shared tokens
(`packages/core/src/tokens.ts`), emitted as CSS variables in `src/lib/tokensCss.ts` — the
stylesheet holds no hex values of its own. Rules: cyan only for verified / live / interactive
things; mono type for measured figures; structure from hairlines, not shadows or gradients.

Marketing copy is **first-draft**: it describes only what the product does today, with no
testimonials, customer logos, or usage numbers (none exist yet).
