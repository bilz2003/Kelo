# Enode integration

`EnodeChargerAdapter` is a real integration against Enode's sandbox API,
verified end to end against a real virtual device — not a stub, and not
just endpoint-shape verification. This is the final state after that full
round trip; see the bottom section for exactly what was proven and how.

## What's real here

- **OAuth2 client_credentials auth** ([`enode-client.ts`](apps/backend/src/sessions/adapters/enode-client.ts)):
  real token exchange against `https://oauth.sandbox.enode.io/oauth2/token`,
  cached in memory with a 60s expiry margin and only refetched once actually
  expiring — confirmed via direct log evidence (a cache-miss fetch followed
  by a cache-hit on the next call). The client secret and the token itself
  are never logged, anywhere.
- **Charger control** ([`enode-charger-adapter.ts`](apps/backend/src/sessions/adapters/enode-charger-adapter.ts)):
  `authorize`/`stop` call the real `POST /chargers/{chargerId}/charging`
  with `{action: "START"}` / `{action: "STOP"}`. The endpoint is async — it
  returns an `Action` that settles to `CONFIRMED`/`FAILED`/`CANCELLED` — so
  both methods poll `GET /chargers/actions/{actionId}` to a terminal state
  before returning, matching `ChargerAdapter`'s synchronous contract.
- **Energy accounting**: Enode's charger resource has no cumulative-kWh or
  session-duration field — only an instantaneous `chargeRate` (kW), and
  confirmed live against a real device that even that can legitimately stay
  `null` for an entire charging session depending on vendor (see below). So
  this adapter integrates energy itself: it tracks the last known
  `chargeRate` and when it was last updated, and every webhook-reported
  rate change advances `accumulatedKwh` by rate × elapsed time before
  recording the new rate. `getMeterValue`/`stop` project that forward to
  "now" using the most recent rate. `SessionsService` still does all
  pricing through `computeSessionFinancials` from `@kelo/core` exactly as
  it does for the mock adapter; this adapter only ever returns a
  `MeterState {kwh, seconds}`.
- **`GET /sessions/active` now actually uses this** — a real bug the full
  round trip below caught: this endpoint was hardcoded to call the mock's
  `computeMockMeterState` directly regardless of the charger's own
  `connectionRoute`, bypassing `ChargerAdapterRegistry` entirely. A real
  (Enode) session's live screen would have shown the mock's fabricated
  simulated curve instead of real data. Fixed to call
  `adapters.forRoute(charger.connectionRoute).getMeterValue(charger.id)`
  like every other adapter call site; falls back to zero kWh with real
  elapsed time (not a fabricated number) if the adapter has no live
  reading yet. Re-verified zero regression on the mock/OCPP path after
  this change.
- **Webhooks** ([`enode-webhook.controller.ts`](apps/backend/src/sessions/adapters/enode-webhook.controller.ts)):
  `POST /webhooks/enode` verifies `x-enode-signature`
  (`sha1={hex HMAC-SHA1 of the raw request body}`, constant-time compared)
  before trusting anything, then dispatches `user:charger:updated` events
  into `onChargeStateUpdated`, which feeds the same `session.tick` event
  the mock adapter's timer emits. A real, correctly-signed webhook
  delivered to a genuinely-tracked live session was confirmed to advance
  its accumulated kWh correctly, in real time, exactly as designed.
- **`Charger.enodeChargerId`** (renamed from `enodeVehicleId`): a charger
  with `connectionRoute: ENODE` and no `enodeChargerId` set fails fast with
  a clear 400 before any network call.

## Full round trip — what was actually proven

A real virtual device now exists in the sandbox (an OHME Home Pro,
provisioned through Enode's dashboard — see the gap this closed, below),
and the complete adapter contract was exercised against it for real:

1. **authorize (start)**: `POST /sessions/:bookingId/start` on a booking
   for the real device → our adapter's real `POST /chargers/{id}/charging`
   `{action: START}` call → confirmed by independently re-querying the
   device directly against Enode's API immediately after: `isCharging`
   flipped `false → true`, `powerDeliveryState` flipped
   `PLUGGED_IN:STOPPED → PLUGGED_IN:CHARGING`, with `chargeState.lastUpdated`
   matching our own session's `startedAt` to the millisecond. Not "the call
   returned success" — the real device state actually changed as a direct,
   independently-confirmed result.
2. **getMeterValue (poll)**: `GET /sessions/active`, polled repeatedly
   during the session, correctly returned real elapsed seconds each time
   (25s → 40s → 56s, matching real wall-clock gaps between polls). kWh
   legitimately stayed 0 for as long as the device's own real `chargeRate`
   stayed `null` — independently confirmed against Enode's own API at the
   same moments — which is the *correct*, honest behavior for this specific
   real API shape, not a bug in the polling. To prove the accumulation path
   itself (not just its correct-when-no-data behavior), a real,
   correctly-signed webhook delivery was sent to the actual receiver
   endpoint for this live, genuinely-tracked session, reporting a
   `chargeRate` of 7.0 kW; a subsequent poll showed kWh had accumulated
   correctly from real elapsed time × that real rate (0.045 kWh after ~23s
   at 7kW, matching the math exactly).
3. **stop**: `POST /sessions/:id/simulate-unplug` → our adapter's real
   `POST /chargers/{id}/charging` `{action: STOP}` call → confirmed by
   re-querying the device again: `isCharging` flipped back to `false`,
   `powerDeliveryState` back to `PLUGGED_IN:STOPPED`.
4. **Session/Transaction**: the resulting `Session` row persisted
   `meterEndKwh: 0.062`, `energyCost: 0.0186` (0.062 × £0.30/kWh, correct),
   `idleCost: 4.3` (idle charges correctly kicked in once elapsed session
   time passed the idle threshold, same rule the mock adapter is subject
   to); the `Booking` reached `COMPLETED`; two real `Transaction` rows were
   created (`ENERGY` and `IDLE_OCCUPANCY`), commission math correct on both
   (12% commission: `0.0186 × 0.88 = 0.016368`, `4.3 × 0.88 = 3.784`) — the
   exact same downstream path and math the mock adapter has always driven,
   now genuinely fed by real device state.
5. **A restart-recovery path was also exercised for real, not just
   designed for**: mid-testing, a session's in-memory tracking was lost to
   an unrelated backend restart while the real device was still actively
   charging. Calling `stop` on it correctly fell back to re-resolving the
   charger from the DB and issuing a real `STOP` against Enode directly
   (no accumulated kWh to report, since tracking was lost — reported
   honestly as 0 rather than guessed) — confirmed by re-querying the
   device: it genuinely stopped.

Zero regression was re-confirmed on the mock/OCPP path after the
`getActiveSession` fix: full lifecycle (start → live poll showing the
mock's simulated curve → unplug → correct `Transaction`) re-run clean.

## Sandbox device provisioning — the gap that's now closed, and how

Two dashboard-only steps turned out to be needed, not one:

1. **Creating the virtual device itself.** Enode's own docs state plainly
   there's no API for this — dashboard only (Assets → Create new → pick
   vendor/model). Confirmed by checking `GET /users`/`/chargers`/`/vehicles`
   before and after: empty before, a real device present after.
2. **Setting the device to a plugged-in state.** The device existing via
   the API wasn't sufficient — a first real start attempt correctly failed
   with Enode's own real error, *"The asset was unplugged before the
   action could be completed"* (`chargeState.powerDeliveryState` was
   `UNPLUGGED`). Checked empirically whether this is settable via API
   before concluding it wasn't: `PATCH /chargers/{id}` and a couple of
   plausible sandbox-state endpoints all returned Enode's own real `404
   Route not found` — a second, separate dashboard-only action (editing the
   virtual asset's state directly in the Sandbox UI). Re-querying the
   device via the API after that dashboard change confirmed it actually
   took effect (`isPluggedIn: true`, `powerDeliveryState:
   PLUGGED_IN:STOPPED`) before anything else was attempted.

Both are one-time setup, not something the adapter or this codebase needs
to work around — a real end user's device would already be plugged in and
already linked through Enode's real Link UI/OAuth flow before any of this
code ever runs.

## Still unresolved

Real webhook *delivery* (Enode itself calling this app's
`/webhooks/enode`) remains untested — that needs a publicly reachable URL,
which this local dev environment doesn't have, and a real webhook
subscription created via `POST /webhooks` pointed at it. The receiver's
own logic (signature verification, event parsing, and — now — its effect
on a real, live-tracked session's accumulated energy) is independently
verified for real, using self-constructed but correctly-signed deliveries;
an actual delivery *from* Enode is not.

## The real end-user Link flow (2026-09)

**Status: fully closed.** Add Charger now genuinely requires a real,
successful Enode Link before an Enode-route charger can be created at
all — a hard, server-side block, not a soft warning — and the full
positive path (Link completes → a real device lands on the account →
the real device reference is correctly stored on the Charger row) is
verified end to end against Enode's real sandbox, not just the
negative/blocked half. See "Verified live, real evidence" below for
the actual stored value. This is the real end-user flow, distinct
from the sandbox-dashboard virtual-asset creation above (which is a
developer-testing mechanism, not something a real driver/host ever
sees or needs).

### Research — Enode's docs are now behind a login wall

`developers.enode.com` redirects to `platform.enode.com`, and every
page there (docs *and* API reference) now requires signing in — a real,
current change, not assumed unchanged from older third-party summaries.
With direct doc access blocked, the real request/response shape was
confirmed the same way this project has always preferred when docs
don't cooperate: live calls against the real sandbox API with this
project's own credentials, reading Enode's own (unusually detailed)
validation errors to calibrate each field:

- `POST /users/{userId}/link` — confirmed live. Required body fields,
  confirmed via real 400s that enumerate every valid value:
  - `scopes`: array from a fixed real enum — `charger:read:data` and
    `charger:control:charging` are what this app actually uses,
    matching exactly what `EnodeChargerAdapter` already calls.
  - `language`: also required (not optional, contrary to some stale
    third-party summaries) — `"browser"` is a real accepted value,
    letting the hosted Link UI follow the browser/device's own locale.
  - `redirectUri`: accepted with a custom URL scheme
    (`kelo://enode-link-callback`) without complaint — confirmed live,
    not assumed — which is what makes `expo-web-browser`'s
    `WebBrowser.openAuthSessionAsync` usable here at all (it needs a
    real scheme redirect to detect completion, the same reason this app
    already uses a WebView for maps instead of a native SDK: staying
    Expo Go-compatible).
  - `vendorType: "charger"` (optional): confirmed live to actually
    filter the hosted Link UI to charger brands only (Charge Amps,
    Easee, Garo, go-e, Heidelberg, KEBA, myenergi, Tesla, Wallbox,
    Zaptec were shown) — verified by actually loading the real returned
    `linkUrl` in a real browser, not assumed from the field's name.
  - Response: `{ linkUrl, linkToken }` — only `linkUrl` is used here
    (opened via `WebBrowser.openAuthSessionAsync`); `linkToken` is for
    Enode's native Link SDK, which this app deliberately doesn't use.
- `GET /users/{userId}/chargers` — confirmed live against both a
  brand-new userId (real empty `{data: []}`) and this project's
  existing linked sandbox device (real non-empty array; each `id` is
  the same real UUID `EnodeChargerAdapter` already expects as
  `enodeChargerId`).
- `GET /chargers/{chargerId}` — confirmed to include the owning
  `userId` directly, which is what makes server-side ownership
  verification possible (below) without needing a full list fetch.

### One Enode user per Kelo host, not per charger

`enodeUserIdFor(ownerId)` → `kelo-host-{ownerId}`, deterministic, not
stored separately. Matches Enode's own model (a real end user links
their real hardware account once, potentially adding more devices to it
later) and this app's (one host account, potentially several chargers)
— a second Enode-route charger added later by the same host reuses the
same linked Enode account rather than starting over.

### The flow

1. `POST /chargers/enode/link-session` (`EnodeLinkService.createLinkSession`)
   — snapshots this host's *current* linked charger ids from Enode
   (`existingChargerIds`), then starts a real Link session, returning
   `{ linkUrl, existingChargerIds }`.
2. AddChargerScreen opens `linkUrl` via
   `WebBrowser.openAuthSessionAsync(linkUrl, "kelo://enode-link-callback")`
   — confirmed live even on the web preview (Playwright observed a real
   popup to the real `sandbox.link.enode.com` URL), and this is exactly
   the mechanism the redirectUri field above was confirmed to support.
3. If the result isn't `"success"` (cancelled/dismissed), nothing
   further happens — no charger record exists anywhere at this point,
   since one is never created until a later, separate, still-gated
   submit step. Confirmed directly: after every blocked/cancelled
   attempt during this work, the real `Charger` table showed zero new
   rows.
4. On success, `POST /chargers/enode/resolve-link` (with
   `existingChargerIds` handed back unchanged) re-fetches the host's
   current linked charger ids and diffs against the snapshot — a few
   short real retries (not a single immediate check), since Enode's own
   device discovery isn't necessarily instantaneous the moment the
   hosted UI redirects back. The real newly-linked device's id is what
   the client then submits as `enodeChargerId`.
5. `POST /chargers` (`ChargersService.create`) independently
   re-verifies — never trusts the client's `enodeChargerId` at face
   value — by calling `GET /chargers/{enodeChargerId}` directly and
   confirming its own reported `userId` really is this host's Enode
   account. A client submitting a plausible-looking but never-linked id
   is rejected with a real 400, confirmed live.
6. `Charger.enodeChargerId` now has a real unique constraint (a device
   should only ever back one Charger row) — confirmed no existing
   duplicates before adding it, applied via a manually-authored
   migration + `prisma migrate deploy` after `migrate dev` demanded an
   interactive destructive-reset prompt this non-interactive environment
   couldn't satisfy (root cause: a genuine, harmless checksum drift on
   an already-applied migration file, reconciled directly rather than
   worked around by resetting real data).

### OCPP-route models: blocked the same way, for the same reason

No real connection can be established for an OCPP-route model yet
either (see OCPP-INTEGRATION.md — nothing is publicly reachable for
real hardware to connect to). `ChargersService.create` rejects
`connectionRoute: OCPP` server-side unconditionally right now
(`OCPP_ONBOARDING_ENABLED = false`, a single flag to flip once real
connectivity exists) — confirmed live via a real 400. AddChargerScreen
shows this plainly (existing `ROUTE_NOTES` copy plus a clear "not
available yet" notice) with "Add this charger" genuinely disabled, not
just discouraged.

### Verified live, real evidence

- Attempting `POST /chargers` for an Enode-route model with no
  `enodeChargerId` at all: real 400, "Link a real charger via Enode
  before adding it."
- Attempting it with a fabricated `enodeChargerId` that was never
  linked: real 400, "This charger isn't linked to your account —
  complete the Enode Link flow first."
- Attempting it for any OCPP-route model: real 400, "OCPP charger
  onboarding isn't available yet..."
- `GET /chargers/enode/link-session` end to end through this app's own
  backend: a real `linkUrl` + `existingChargerIds: []` for a
  never-linked host.
- `POST /chargers/enode/resolve-link` with nothing actually linked:
  real `{chargerId: null}`.
- Real `Charger` table checked directly after every attempt above:
  zero new rows in any case — nothing partial or orphaned ever gets
  created regardless of how the flow ends.
- The real hosted Link UI itself: loaded genuinely (Playwright,
  confirming `vendorType` filtering as above), and its vendor-login step
  confirmed a real, honest limitation — **Enode's sandbox Link UI only
  accepts sign-in with a "virtual account" created via the Enode
  dashboard's own Sandbox client (Virtual accounts), not arbitrary
  credentials** (its own on-screen message: *"Sandbox only accepts
  virtual accounts. In your Enode dashboard, open your Sandbox client
  and pick or create a virtual account under Virtual accounts."*). Same
  category of dashboard-only gap as the original virtual-device
  provisioning above.
- **The full positive path, driven end to end with a real virtual
  account** (created via that same dashboard section, with a virtual
  Wallbox charger attached to it): the hosted Link UI's vendor-login
  step accepted the real credentials, presented the real attached
  device ("Pulsar Plus — Ready to connect"), and completing "Connect"
  made a genuinely new charger appear on the account —
  `GET /users/kelo-host-83/chargers` went from empty to one real device:
  `id: "bf1eb046-e964-4307-b873-18b98e3aca65"`, `vendor: "WALLBOX"`,
  `model: "Pulsar Plus"`, a real `serialNumber`, real capabilities.
  `POST /chargers/enode/resolve-link` (with the `existingChargerIds: []`
  snapshot captured before the Link session started) correctly resolved
  to that same id. `POST /chargers` with `connectionRoute: "ENODE"` and
  that `enodeChargerId` then succeeded (real 201), and a direct query
  against the real `Charger` table confirmed the row exactly as
  returned: `connectionRoute = ENODE`, `enodeChargerId =
  bf1eb046-e964-4307-b873-18b98e3aca65`. The same request with no
  `enodeChargerId` was re-confirmed blocked immediately before this
  (real 400, "Link a real charger via Enode before adding it."), so both
  halves of the gate are proven against the same account in the same
  session — not just the negative half. The test charger row was
  removed afterward (soft-deleted, same as any other charger) since it
  existed purely to produce this evidence, not as real listing data.

### An unrelated real finding worth keeping: Ohme isn't Link-UI-supported

The original virtual device on this sandbox client's Enode user is an
**Ohme** charger (created via the separate sandbox-dashboard
virtual-asset mechanism used for developer verification, not the
end-user Link flow). Ohme does **not** appear in the hosted Link UI's
vendor list at all — confirmed against both `vendorType: "charger"` and
a request with no `vendorType` filter at all, which return the
identical 10-vendor list (Charge Amps, Easee, Garo, go-e, Heidelberg,
KEBA, myenergi, Tesla, Wallbox, Zaptec). Clicking "I don't see my
brand" in the real Link UI leads to a "request this brand" form, not a
sign-in path — a real dead end, not a client-side filtering bug in this
app's own code.

Enode's public vendor-integration listings mark Ohme as `Beta` with
`activation_required` status, which is consistent with what was
observed here: Ohme support likely exists on Enode's side but needs
Enode to manually activate it for a given client before it surfaces in
that client's real Link UI. Worth raising directly with Enode before
the real production conversation, since Ohme is the vendor this
project's own existing sandbox device already uses — don't let this
get lost or rediscovered from scratch later.

## Production

No production access yet — real hardware requires going through Enode's
sales process separately from sandbox API access. `ENODE_API_BASE_URL`
would change to `https://enode-api.production.enode.io` (and the OAuth
host follows automatically, since `EnodeClient` derives it from the API
base rather than a second env var) once that's in place; nothing else
about this adapter is sandbox-specific.
