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

## Production

No production access yet — real hardware requires going through Enode's
sales process separately from sandbox API access. `ENODE_API_BASE_URL`
would change to `https://enode-api.production.enode.io` (and the OAuth
host follows automatically, since `EnodeClient` derives it from the API
base rather than a second env var) once that's in place; nothing else
about this adapter is sandbox-specific.
