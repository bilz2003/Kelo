# Enode integration readiness

This is a **structural readiness** pass, not a real integration. Nothing in
this codebase makes a real network call to Enode. The goal was to make the
eventual real integration a contained, one-place change instead of a rewrite
— and to write down, from Enode's actual current docs, what that real change
will need.

## What exists today

- `Charger.connectionRoute` (`OCPP` | `ENODE`) and `Charger.enodeVehicleId`
  — [prisma/schema.prisma](apps/backend/prisma/schema.prisma) — already
  existed before this pass.
- [`ChargerAdapter`](apps/backend/src/sessions/adapters/charger-adapter.interface.ts)
  — the interface every connection route implements: `authorize`, `stop`,
  `getMeterValue`.
- [`ChargerAdapterRegistry`](apps/backend/src/sessions/adapters/charger-adapter-registry.ts)
  — picks the right adapter per session, by that session's own charger's
  `connectionRoute`. `SessionsService` depends on the registry, not on a
  fixed adapter — this is what used to be a single hardcoded
  `CHARGER_ADAPTER` binding to the mock, regardless of route.
- [`EnodeChargerAdapter`](apps/backend/src/sessions/adapters/enode-charger-adapter.ts)
  — a stub. Every method throws a clear `ServiceUnavailableException`
  ("Enode integration is not configured") immediately, rather than silently
  behaving like the mock. A charger accidentally created with
  `connectionRoute: ENODE` fails loudly at session start, not with a
  confusing downstream error once something already looked like it worked.
- `ENODE_CLIENT_ID`, `ENODE_CLIENT_SECRET`, `ENODE_API_BASE_URL` — env var
  placeholders in `apps/backend/.env`, all unset/blank. Nothing reads them
  yet.
- `OCPP` still routes to `MockChargerAdapter`, exactly as it did before this
  pass — there is no real OCPP central system in this codebase either, and
  BACKEND-PLAN.md's own recommendation is to build against the mock first.
  This pass changed nothing about OCPP-route behavior.

## What real implementation will actually require

Verified live against Enode's current developer docs
(developers.enode.com) while writing this doc — not from training-data
memory, since API surfaces like this move. Re-verify before writing real
code against any of it; a few paths below could not be confirmed at all
(see the explicit gap at the end).

### Auth: OAuth2 client credentials

- Sandbox API base: `https://enode-api.sandbox.enode.io`
- Production API base: `https://enode-api.production.enode.io`
- Token endpoint (sandbox): `https://oauth.sandbox.enode.io/oauth2/token`
- Request: `POST`, HTTP Basic auth (`-u {CLIENT_ID}:{CLIENT_SECRET}`), body
  `grant_type=client_credentials`
- Tokens are short-lived (~3599s / ~1 hour) — a real adapter needs its own
  token cache/refresh, not a fetch-per-request.

### Linking a user's vehicle/charger

- `POST /users/{userId}/link` returns a `linkUrl` — Enode's own hosted flow
  for the account owner to connect their vendor account. Request specifies
  a `vendorType` (`vehicle` | `charger` | `HVAC` | `solar`) and scopes.
- `GET /users/{userId}` fetches what's currently linked for that user.
- This is the piece `Charger.enodeVehicleId` is presumably meant to store
  the result of — nothing currently populates it; there's no linking flow
  in this codebase yet either.

### Webhooks (how Enode reports real charging-state changes)

- Enode delivers state changes as an HTTPS `POST` to a subscribed URL —
  not a polling model. Payload is a JSON array of up to 100 events per
  delivery, each shaped roughly `{ event, createdAt, version, ...}`.
- Headers `x-enode-delivery` (delivery id) and `x-enode-signature`
  (`sha1={hex HMAC-SHA1 of the raw JSON body}`, secret ≥128 bits) —
  a real adapter's webhook receiver must verify this signature over the
  *raw* body before trusting anything in it.
- Subscriptions are created via a "Create Webhook" endpoint (not
  independently re-verified below — see the gap section).
- This is the natural real source for `getMeterValue`/session-end
  detection with a real charger, replacing `simulateUnplug`'s mock
  "driver taps a button" signal in `SessionsService` with an actual
  hardware-reported event.

### Charger-specific control endpoints — NOT verified

Attempts to independently confirm the actual charger get/start/stop
charging-session endpoints
(`developers.enode.com/reference/getcharger`, `/reference`, and
`/docs/chargers`) all returned 404 during this pass — most likely because
Enode's reference pages are JS-rendered and weren't reachable as static
HTML from here, not necessarily that the endpoints don't exist. **Do not
trust any endpoint path for actual charger control (starting/stopping a
charge session, reading a live meter value) without re-confirming directly
against Enode's dashboard/reference docs while logged in, or against their
OpenAPI spec if they publish one.** This is the one piece of this doc that
is a known gap rather than a verified fact.

## What "real" implementation means, concretely

1. `EnodeChargerAdapter` gets a real HTTP client, reads
   `ENODE_CLIENT_ID`/`ENODE_CLIENT_SECRET`/`ENODE_API_BASE_URL`, and
   implements the OAuth2 client-credentials token exchange with caching.
2. A real linking flow (`POST /users/{userId}/link`) somewhere in the host
   onboarding/charger-creation UI, storing the result in
   `enodeVehicleId` (or a renamed field, if Enode's model turns out to key
   off charger id rather than vehicle id — needs checking once the
   charger-control endpoints are confirmed).
3. `authorize`/`stop`/`getMeterValue` call the real (currently unverified)
   charger-control endpoints instead of throwing.
4. A webhook receiver endpoint, registered as an Enode webhook subscription,
   verifying `x-enode-signature` and feeding real state changes into the
   same `session.ended`/meter-tick path `simulateUnplug` and
   `computeMockMeterState` currently serve for the mock.
5. `ChargerAdapterRegistry` needs no changes at that point — it already
   routes `ENODE` to whichever class implements `EnodeChargerAdapter`.

None of the above exists yet. This pass is scaffolding, not integration.
