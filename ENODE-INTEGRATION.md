# Enode integration

`EnodeChargerAdapter` is a real integration against Enode's sandbox API —
not a stub. It's never been exercised against a live virtual device end to
end, though (see the Sandbox section below for exactly why), so treat the
"what's verified" section as the honest boundary of what this actually
proves.

## What's real here

- **OAuth2 client_credentials auth** ([`enode-client.ts`](apps/backend/src/sessions/adapters/enode-client.ts)):
  real token exchange against `https://oauth.sandbox.enode.io/oauth2/token`,
  cached in memory with a 60s expiry margin and only refetched once actually
  expiring — confirmed via direct log evidence (a cache-miss fetch followed
  by a cache-hit on the next call, no second network round trip). The
  client secret and the token itself are never logged, anywhere.
- **Charger control** ([`enode-charger-adapter.ts`](apps/backend/src/sessions/adapters/enode-charger-adapter.ts)):
  `authorize`/`stop` call the real `POST /chargers/{chargerId}/charging`
  with `{action: "START"}` / `{action: "STOP"}` — this body shape was
  confirmed live (not guessed) by POSTing an empty body and reading back
  Enode's own real validation error, which named exactly these two allowed
  values. The endpoint is async — it returns an `Action` that settles to
  `CONFIRMED`/`FAILED`/`CANCELLED` — so both methods poll
  `GET /chargers/actions/{actionId}` (confirmed live: it 400s on a
  non-UUID id exactly per its own validation) to a terminal state before
  returning, matching `ChargerAdapter`'s synchronous contract.
- **Energy accounting**: Enode's charger resource has no cumulative-kWh or
  session-duration field — confirmed against Enode's own chargers OpenAPI
  schema, which lists only `isPluggedIn`/`isCharging`/`chargeRate`/
  `maxCurrent`/`powerDeliveryState`, nothing energy-cumulative. So unlike a
  real OCPP StopTransaction (which just hands back a final reading), this
  adapter integrates energy itself: it tracks the last known `chargeRate`
  and when it was last updated, and every webhook-reported rate change
  advances `accumulatedKwh` by rate × elapsed time before recording the new
  rate. `getMeterValue`/`stop` project that forward to "now" using the most
  recent rate. `SessionsService` still calls `computeSessionFinancials`
  from `@kelo/core` exactly as it does for the mock adapter — this adapter
  only ever returns a `MeterState {kwh, seconds}`, same as the interface
  requires; no pricing logic lives here.
- **Webhooks** ([`enode-webhook.controller.ts`](apps/backend/src/sessions/adapters/enode-webhook.controller.ts)):
  `POST /webhooks/enode` verifies `x-enode-signature`
  (`sha1={hex HMAC-SHA1 of the raw request body}`, constant-time compared)
  before trusting anything in the payload, then dispatches
  `user:charger:updated` events into the adapter's `onChargeStateUpdated`,
  which feeds the same `session.tick` event the mock adapter's timer
  already emits — real hardware-reported rate changes drive the exact same
  downstream path (WebSocket gateway, live screens) the simulated curve
  does today. Verified for real: a correctly-signed payload is accepted, a
  tampered or missing signature is rejected with 403, and dispatching an
  event for a charger with no actively-tracked session is a safe no-op.
- **Registry wiring**: `ChargerAdapterRegistry` is unchanged — `ENODE`
  already routed to `EnodeChargerAdapter`; that class just does real work
  now instead of always throwing.
- **`Charger.enodeChargerId`** (renamed from `enodeVehicleId`, which didn't
  match what Enode's charger-control endpoints actually key off — they
  address a charger by its own `chargerId`, not a vehicle id). A charger
  with `connectionRoute: ENODE` and no `enodeChargerId` set fails fast with
  a clear 400 before any network call — it's never been linked to a real
  device.

## Sandbox: virtual device provisioning is a real, unresolved gap

Before writing any of the above, connectivity was confirmed first, per the
task: a real `client_credentials` token exchange against
`https://oauth.sandbox.enode.io/oauth2/token` succeeded (HTTP 200, a real
access token). `GET /chargers`, `/vehicles`, and `/users` on that sandbox
client all returned empty, though — no virtual device exists to test
against.

Checked directly against Enode's own current docs (not assumed): creating
a sandbox virtual device is **dashboard-only**. Their own getting-started
guide states plainly: *"In sandbox, you must first create a virtual
asset"*, done through their customer dashboard (Assets → Create new → pick
vendor/model) — there is no documented API endpoint for this step. Two
independent doc fetches confirmed the same thing; nothing suggests a
backend-only path exists. This is exactly the same class of gap as the
push-notification Simulator limitation elsewhere in this project: a real,
stated boundary, not one papered over.

**Consequence**: every endpoint this adapter calls has been confirmed
against the real API (real 200 token exchange; real 400 validation errors
naming the exact allowed `action` values; real 400 UUID validation on the
actions endpoint; a real 404 "Charger not found" correctly propagated end
to end through a booking → session-start call when pointed at a
syntactically-valid-but-nonexistent device id) — but the full path of
"start a real virtual charger, have it report a real `chargeRate` via a
real webhook, watch that accumulate into a real Session/Transaction" has
not been exercised, because no virtual device exists to start. Provisioning
one requires a human going into the Enode dashboard; that hasn't happened
yet. Once it has, this adapter should work against it as written — the
gap is entirely in test-fixture availability, not unverified code paths.

**Also unresolved**: real webhook delivery has not been tested, because
Enode's webhook subscription (`POST /webhooks`) needs a publicly reachable
URL, which this local dev environment doesn't have. The receiver's own
logic (signature verification, event parsing, safe-ignore of untracked
chargers) is independently verified and real; an actual delivery from
Enode to this endpoint is not.

## Production

No production access yet — real hardware requires going through Enode's
sales process separately from sandbox API access. `ENODE_API_BASE_URL`
would change to `https://enode-api.production.enode.io` (and the OAuth
host follows automatically, since `EnodeClient` derives it from the API
base rather than a second env var) once that's in place; nothing else
about this adapter is sandbox-specific.
