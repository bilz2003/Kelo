# OCPP 1.6-J integration

A real OCPP 1.6-J central system (`OcppCentralSystem`) and a real,
scripted local simulator, tested against each other end to end on
localhost. This is genuinely proven against a real OCPP-J charge point —
just not a physical one, and not over the internet. See "What's still
open" for exactly what that leaves unverified.

## The library decision

Checked whether a mature, actively-maintained npm package handles OCPP-J's
message framing before writing anything by hand — same standard as the
Prisma/geocoding-provider decisions earlier in this build.

**Chosen: [`ocpp-rpc`](https://github.com/mikuso/ocpp-rpc)** (24k+
downloads/month, ~4 years of sustained releases 2022–2025, MIT, ships its
own `.d.ts`). It handles exactly the hard, easy-to-get-subtly-wrong part:
CALL/CALLRESULT/CALLERROR framing, unique-id matching, ocpp1.6 subprotocol
negotiation, and — critically — bundles the **official OCPP 1.6/2.0.1/2.1
JSON schemas from the Open Charge Alliance** for `strictMode` validation.
It provides both `RPCServer` and `RPCClient` from the same package, so the
real central system and the local simulator run on the *same*
well-tested wire implementation — a test failure means something in
Kelo's own message handling, not an incidental mismatch between two
independent OCPP-J stacks.

**Considered and rejected:**
- **Hand-rolling the framing directly on `ws`**: rejected. The framing
  itself (`[2,id,action,payload]` / `[3,id,payload]` / `[4,id,code,desc,details]`)
  is simple, but call/response correlation, timeout handling, subprotocol
  negotiation, and OCPP's actual field-level schemas are not — reimplementing
  all of that correctly, for a protocol this codebase has no prior
  familiarity with, is exactly the kind of well-solved problem not worth
  re-solving from scratch.
- **`ocpp-eliftech`**: abandoned since 2019 (last publish), depends on
  `ws@4` and `joi@13` — genuinely dead, not a real candidate.
- **`typed-ocpp`**: actively maintained and TypeScript-native, but it's a
  message *typing/validation* library only — no connection/RPC transport,
  no subprotocol negotiation. `ocpp-rpc`'s bundled schema validation
  already covers what this would add; using both would mean two schema
  sources with no clear benefit.
- **Standalone simulator tools** (`docile-charge-point` — Scala/JVM;
  `ocpp-virtual-charge-point` — Node but not npm-installable, runs as a
  separate process controlled through its own admin WebSocket proxy, not
  directly scriptable; `OCPP-Sim` — not published to npm, own
  independent client implementation): all rejected in favor of scripting
  the simulator directly on `ocpp-rpc`'s own `RPCClient` — see below.

## What exists

- **`OcppCentralSystem`** ([`ocpp-central-system.ts`](apps/backend/src/sessions/ocpp/ocpp-central-system.ts)) —
  a real `RPCServer` (`strictMode: true`, subprotocol `ocpp1.6`), started
  in `onModuleInit` on its own port (`OCPP_PORT`, default 9220 — separate
  from the main HTTP API). Handles exactly the messages this product
  needs:
  - `BootNotification`, `Heartbeat`, `StatusNotification` — accepted/logged.
  - `Authorize` — accepted unconditionally. Per the product doc's own
    authorization model, the driver confirms in-app and the backend
    sends `RemoteStartTransaction`; there's no local card-present flow
    here, so any `idTag` reaching this handler is one Kelo minted itself.
  - `RemoteStartTransaction` / `RemoteStopTransaction` — sent *to* the
    charge point by `remoteStart`/`remoteStop`, not handled as incoming.
  - `StartTransaction` — only accepted if there's a pending remote-start
    waiting for it (no local-start path in this model); mints
    `transactionId` as the same number as Kelo's own `Session.id`.
  - `StopTransaction` — the one message with two real, distinct meanings
    (see "Unified finalization" below).
  - `MeterValues` — updates live meter state and emits the same
    `session.tick` event the mock adapter's timer and Enode's webhook
    handler already emit, driving the exact same WebSocket bridge to
    the app.
- **`OcppChargerAdapter`** ([`ocpp-charger-adapter.ts`](apps/backend/src/sessions/adapters/ocpp-charger-adapter.ts)) —
  implements `ChargerAdapter` (`authorize`/`stop`/`getMeterValue`),
  delegating to `OcppCentralSystem`. Registered in `ChargerAdapterRegistry`
  for `connectionRoute: OCPP` — a real charger, not a parallel path.
- **`MOCK` is now its own explicit `connectionRoute`**, not a synonym for
  `OCPP`. Every charger previously tagged `OCPP` was actually always
  driven by `MockChargerAdapter` (there was no real OCPP central system
  until now); the migration adding `MOCK` re-tagged all of them, so
  nothing's behavior silently changed underneath existing data. `OCPP`
  now means a real charge point.
- **Unified finalization**: `SessionsService.finalizeSession` is the one
  place any session's `Session`/`Booking`/`Transaction` rows get written
  and `computeSessionFinancials` gets called, for every route:
  - **Driver/backend-triggered stop** (mock's endpoint standing in for
    hardware, a real Enode STOP, or a real `RemoteStopTransaction`):
    `simulateUnplug` calls the adapter's `.stop()`, then `finalizeSession`.
  - **A real OCPP charge point's own unsolicited `StopTransaction`** — a
    genuine physical unplug it reported with no `RemoteStopTransaction`
    behind it, and so no HTTP caller anywhere in the stack —
    `OcppCentralSystem` emits `ocpp.stop.unsolicited`;
    `SessionsService.onOcppUnsolicitedStop` is its only listener, and it
    calls the *same* `finalizeSession`. Not a second, parallel path.
  - A backend-requested OCPP stop and an unsolicited one are
    disambiguated inside `OcppCentralSystem.onStopTransaction` by whether
    a `remoteStop()` caller is actively waiting for that transaction id —
    if so, that waiter resolves (and `simulateUnplug`'s own call to
    `finalizeSession` handles it); if not, it's unsolicited and
    `OcppCentralSystem` finalizes it directly. Verified both paths
    independently — see below.
- **The local simulator** ([`scripts/ocpp-simulator.js`](apps/backend/scripts/ocpp-simulator.js)) —
  a real OCPP-J charge point, built on `ocpp-rpc`'s own `RPCClient`.
  Connects, sends `BootNotification`, responds to `RemoteStartTransaction`
  by sending a real `StartTransaction`, sends periodic real `MeterValues`
  (energy computed from a configurable kW rating over real elapsed time —
  not a fixed demo curve), responds to `RemoteStopTransaction`, and — via
  a `stdin` `unplug` command — sends a genuinely unsolicited
  `StopTransaction`, simulating a driver physically disconnecting.

## Full round trip — what was actually proven, and how

Every point below was independently re-confirmed (backend's own log,
simulator's own log, and/or a direct DB query), not inferred from one
side's response alone:

1. **Simulator boots, connects, `BootNotification` accepted** — confirmed
   on *both* sides: the simulator's own log showed
   `BootNotification -> status=Accepted`, and `OcppCentralSystem`'s own
   log independently recorded `BootNotification from SIM-CP-001: Kelo
   ocpp-simulator` at the same moment.
2. **`RemoteStartTransaction` received and acted on** — not just "the
   backend's call returned success": `POST /sessions/:id/start` returned
   normally, and the simulator's *own* log independently showed
   `RemoteStartTransaction received: idTag=KELO-52`, followed by
   `StartTransaction confirmed, transactionId=39` — the transaction id
   Kelo's own `Session.id` (39) round-tripped back correctly.
3. **Real `MeterValues` drive the live WebSocket bridge** — a real
   Socket.IO client subscribed to the session and received real `tick`
   events with genuinely increasing `kwh`/`seconds`
   (`kwh: 0.086 -> 0.089 -> 0.093`, `seconds: 44 -> 46 -> 48`), matching
   what the simulator's own log showed it was sending at the same time —
   not read from a poll, but pushed live, the same path the mock and
   Enode adapters already drive.
4. **Simulated unplug (unsolicited `StopTransaction`) finalizes the
   session correctly** — the simulator's `unplug` command sent a real
   `StopTransaction` with no preceding `RemoteStopTransaction`; the
   resulting `Session` row persisted `meterEndKwh: 0.105` (matching the
   simulator's own reported `meterStop=105` Wh exactly), `energyCost:
   0.0315` (0.105 × £0.30, correct), `Booking` reached `COMPLETED`, and
   real `ENERGY`/`IDLE_OCCUPANCY` `Transaction` rows were created with
   correct 12% commission math — with **no HTTP request from anywhere**
   driving it, confirming the unsolicited path genuinely self-triggers
   finalization through `SessionsService.onOcppUnsolicitedStop`.
5. **Re-checked the exact bug class the Enode work found**
   (`GET /sessions/active` silently falling back to fabricated mock
   timing): explicitly compared a real OCPP session against a real MOCK
   session at the identical elapsed time (12s). MOCK returned
   `kwh: 0.933` (exactly the accelerated demo curve's own formula).
   The OCPP session, at the same 12s mark, had independently shown
   `kwh: 0.023` — real, MeterValues-integrated data, an order of
   magnitude different from the mock curve. Confirms `getActiveSession`
   genuinely branches by `connectionRoute` for this third adapter too,
   not just the two it was fixed for during the Enode work.
6. **Zero regression on both mock and Enode** — re-ran full lifecycles on
   each after all of this task's changes (including the shared
   `finalizeSession` refactor and the `MOCK` route split):
   - **Mock**: start -> live poll (`kwh: 0.933` at 12s, matching its own
     known curve) -> unplug -> `Session`/`Booking`/`Transaction` all
     correct (`energyCost: 0.42` on `kwh: 1.4`).
   - **Enode**: re-used the same real sandbox virtual device from the
     earlier Enode work (still plugged in) — real `authorize()` genuinely
     transitioned it `PLUGGED_IN:STOPPED -> PLUGGED_IN:CHARGING`
     (independently re-queried against Enode's own API), real `stop()`
     transitioned it back, `Booking` reached `COMPLETED`, a real
     `Transaction` was recorded.

A real bug was caught and fixed while building this, before any of the
six points above were run: `onMeterValues` was originally written to only
update internal meter state — it never emitted `session.tick` at all, so
real `MeterValues` from the charge point would have silently never
reached the WebSocket bridge, even though `getMeterValue`/polling would
still have shown correct numbers. Point 3 above is the test that would
have caught this the moment it was run; it was caught first by re-reading
the code against what `MockChargerAdapter`'s timer and
`EnodeChargerAdapter`'s webhook handler both already do, and fixed before
testing rather than after. `GET /sessions/active`'s adapter-lookup bug
from the Enode work (point 5 above) is the one that genuinely was a fresh
instance of "only half fixed for one adapter" — caught here by explicitly
re-testing the third adapter against that exact bug class rather than
assuming the earlier fix generalized.

## What's still open

**Connecting a real physical charger requires the backend to be actually
deployed somewhere internet-reachable — this local dev setup can't do
that, and doing so is a separate, not-yet-scoped task.** Everything above
is genuinely proven against a real OCPP-J implementation speaking the
real protocol correctly — the simulator is not a mock of OCPP, it's a
real charge point role, just not physical hardware. What remains
unverified is specific to real hardware and a public deployment, not to
protocol correctness:
- A real charge point's actual timing/reconnection behavior, TLS/security
  profile requirements a real deployment would need (this build runs
  `ws://`, unauthenticated at the transport level — real hardware in the
  field would need Security Profile 2/3, which `ocpp-rpc` supports but
  isn't configured here), and real-world network interruption patterns.
- The reconnection story `BACKEND-PLAN.md` calls out (a charge point's
  own meter keeps counting internally regardless of the WebSocket link)
  is implemented as designed — `OcppCentralSystem` deliberately doesn't
  tear down transaction state on disconnect — but was only exercised
  incidentally here (via backend hot-reloads during development, not a
  deliberate reconnection test), not verified as its own scenario.
