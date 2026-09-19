# Kelo

Kelo is an EV-charging marketplace: drivers book time on chargers that hosts own, and every
session is billed from the **charger's own verified meter reading** — not a time slot or an
estimate. One account works everywhere: the same person can drive, host, and manage their
listings from the phone or the browser.

This repository is an npm-workspaces monorepo. If you're new here, read this page top to bottom,
then follow the links in [Where to read more](#where-to-read-more).

## The four pieces

```
                 ┌────────────────────┐        ┌────────────────────────┐
  drivers,       │    apps/mobile     │        │        apps/web        │   hosts (and anyone
  hosts   ─────▶ │  Expo / React      │        │  Next.js (App Router)  │ ◀─ curious about Kelo)
                 │  Native app        │        │  marketing + dashboard │
                 └─────────┬──────────┘        └───────────┬────────────┘
                           │  bearer tokens                 │  Next.js server calls the API;
                           │                                │  tokens live in httpOnly cookies
                           ▼                                ▼
                 ┌──────────────────────────────────────────────────────┐
                 │                    apps/backend                      │
                 │   NestJS API  ·  OCPP 1.6-J central system (WS)      │
                 │   one User table, one database, one auth system      │
                 └───────┬───────────────────────┬──────────────────────┘
                         │                       │
                    PostgreSQL              chargers (OCPP)
                    (AWS RDS)               Enode (planned brands)

                 ┌──────────────────────────────────────────────────────┐
                 │  packages/core — shared types, pricing rules, dates, │
                 │  design tokens. Imported by mobile, web AND backend. │
                 └──────────────────────────────────────────────────────┘
```

| Workspace | What it is | Who uses it |
|---|---|---|
| [`apps/mobile`](apps/mobile) | The native **driver + host app** (Expo / React Native). Everything a user *does* with Kelo happens here: discover and book chargers, run a live charging session, add a charger and verify its connection, watch your own chargers as drivers use them. | Drivers and hosts |
| [`apps/web`](apps/web) | The **public marketing site** plus a **host self-service dashboard** (Next.js, App Router, TypeScript). The dashboard covers managing existing listings (edit details and photos, availability, remove) and viewing earnings. It deliberately has **no booking, Discover, live-session, or Add Charger functionality** — those stay in the app. | Prospective hosts; existing hosts managing listings |
| [`apps/backend`](apps/backend) | The **shared API** (NestJS + Prisma + PostgreSQL) that both clients consume, plus Kelo's own **OCPP 1.6-J central system** that chargers connect to. Owns auth, bookings, sessions, pricing, payments plumbing, photos. | `apps/mobile`, `apps/web` |
| [`packages/core`](packages/core) | **Shared TypeScript** with no framework dependencies: domain types, the pricing/commission rules (`computeSessionFinancials`), date helpers, and the **design tokens**. | All three apps |

There's also [`infrastructure/`](infrastructure) — the AWS CDK app (database, bastion, photo
bucket). It's a workspace but not a Kelo product surface.

### One account, not two

There is a single `User` table and a single set of auth endpoints (`/auth/register`, `/auth/login`,
`/auth/refresh`, `/auth/logout`). The mobile app and the website both call **the same endpoints**;
neither has its own account store. `User.createdVia` (`web` | `mobile`) records which client an
account was registered through — it's an analytics signal, not a permission.

They differ only in how they hold the tokens:

- **Mobile** keeps the access/refresh tokens in the device's secure storage and attaches the
  access token itself.
- **Web** uses a backend-for-frontend: Next.js Route Handlers call the API server-side and store
  the tokens as **httpOnly, Secure, SameSite=Lax cookies**, so page JavaScript can never read a
  token. Refresh-on-expiry is done server-side (see [`apps/web/README.md`](apps/web/README.md)).

### Design tokens

Colours, radii, spacing and typeface roles live once, framework-agnostically, in
[`packages/core/src/tokens.ts`](packages/core/src/tokens.ts). Mobile re-exports them; web turns them
into CSS variables. The brand rules apply on every surface: **cyan is reserved for things that are
verified, live, or interactive — never decoration**, and mono type is for measured figures.

## Getting started

Requirements: Node 22, npm (workspaces), and — to talk to the real dev database — the AWS CLI and
the Session Manager plugin.

```bash
npm install            # from the repo root; installs every workspace
```

`packages/core` is consumed via its compiled `dist/`, so rebuild it after changing it:

```bash
npm run build -w @kelo/core        # or: cd packages/core && npx tsc
```

Run things (each in its own terminal):

| Service | Command | Port |
|---|---|---|
| Backend API | `cd apps/backend && npx nest start --watch` | 3000 |
| OCPP central system | started by the backend | 9220 |
| Website | `cd apps/web && npx next dev -p 3001` (or `next build && next start -p 3001`) | 3001 |
| Mobile app | `cd apps/mobile && npx expo start` (`--web` for a browser preview) | 8081 |

- The backend reads its config from `apps/backend/.env` (start from
  [`.env.example`](apps/backend/.env.example)). It talks to PostgreSQL on AWS RDS through an SSM
  port-forward on `localhost:15432` — setup and the bastion workflow are in
  [DATABASE.md](DATABASE.md).
- The website needs one variable, `KELO_API_URL` (server-side only) — see
  [`apps/web/.env.example`](apps/web/.env.example).
- The mobile app reads `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3000`).
- No physical charger is needed to try OCPP: a scripted simulator lives at
  [`apps/backend/scripts/ocpp-simulator.js`](apps/backend/scripts/ocpp-simulator.js).

### Checking your work

There is no automated E2E suite yet. The standing checks are:

```bash
# type-check every workspace (each uses its own TypeScript version — mobile pins TS 6, the rest 5.9)
npm run typecheck --workspaces --if-present

cd apps/backend && npx nest build           # backend build
cd apps/mobile  && npx expo export --platform ios && npx expo export --platform android
cd apps/web     && npx next build           # website build
```

How the mobile app is driven against the real backend for verification is written up in
[TESTING.md](TESTING.md).

## Database changes

Schema lives in [`apps/backend/prisma/schema.prisma`](apps/backend/prisma/schema.prisma) with
migrations under `apps/backend/prisma/migrations/`. Apply with `npx prisma migrate deploy` (from
`apps/backend`, tunnel up) and confirm there's no drift with `npx prisma migrate status`.

## Where to read more

| Doc | Covers |
|---|---|
| [BACKEND-PLAN.md](BACKEND-PLAN.md) | Backend architecture and the data model rationale |
| [DATABASE.md](DATABASE.md) | The RDS database, bastion/SSM tunnel, IAM, budgets, CDK workflow |
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Non-database AWS resources (the private photo bucket) |
| [OCPP-INTEGRATION.md](OCPP-INTEGRATION.md) | The OCPP 1.6-J central system and its simulator |
| [ENODE-INTEGRATION.md](ENODE-INTEGRATION.md) | The Enode integration (Link flow, adapter) |
| [MAP-INTEGRATION.md](MAP-INTEGRATION.md) | The Discover map |
| [TESTING.md](TESTING.md) | Driving the real app against the real backend |
| [`apps/web/README.md`](apps/web/README.md) | The website: routes, the auth/BFF design, its boundary |
