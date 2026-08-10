# Kelo — Backend Planning

This document proposes the backend architecture for Kelo, building directly
on the product doc's technical architecture section and everything the
frontend build has already established (the pricing model, the booking
state machine, the exact commission splits). Nothing here is locked in —
it's written to be argued with before anything gets built, the same way
the React Native decision was.

---

## 1. Recommended stack: Node.js + TypeScript (NestJS), PostgreSQL

**The reasoning, not just the pick:**

- **Shares a language and, more importantly, shares actual code with the
  app.** This was the whole stated reason for choosing React Native over
  Flutter or native Swift/Kotlin — it only pays off if the backend is
  TypeScript too. `src/types/index.ts`, `src/utils/pricing.ts`, and
  `src/utils/dateTime.ts` in the RN project were deliberately written with
  zero React dependencies, specifically so they can be extracted into a
  shared `@kelo/core` package both sides import. A non-TS backend throws
  that advantage away entirely.
- **NestJS specifically** (over plain Express/Fastify) because this app
  has real structural complexity worth a real framework: multiple
  integration adapters (OCPP, Enode) behind one interface, webhook
  ingestion (Stripe, Enode), scheduled jobs (no-show release, overstay
  detection), and WebSocket handling (live session updates) — Nest's
  module system and dependency injection keep that organized as it grows,
  rather than becoming a pile of route handlers.
- **PostgreSQL** because bookings have real relational integrity
  requirements (no double-booking the same charger for overlapping
  windows, foreign keys between users/chargers/bookings/sessions/payments)
  that a document database would fight you on. Nothing here needs
  Mongo-style flexible schemas.

**Alternative worth naming honestly:** a lighter Express + tRPC setup
would also get you TypeScript type-sharing (arguably even more directly
than NestJS's REST/GraphQL layer, since tRPC infers types end-to-end
without codegen) and less framework overhead. I'd lean NestJS given the
genuine multi-adapter complexity here, but if the team is small and wants
to move fast rather than structure early, tRPC is a legitimate different
answer — worth deciding deliberately rather than defaulting.

---

## 2. Core data model

Mirrors the `Charger` type already in the RN app, extended with what only
the backend needs to know about:

```
User
  id, email, name, phone
  stripe_customer_id       (driver-side: for charging their card)
  stripe_connect_account_id (host-side: for paying them out, nullable
                              until they list their first charger)
  created_at

Charger
  id, owner_id -> User
  postcode, full_address (private until a booking is paid)
  title, power_kw, cable_type, connector_type
  rate, overstay_rate, idle_rate, no_show_fee   -- host-set, bounded
  host_cost                                      -- private, optional
  listing_name                                   -- nullable, falls back
                                                     to "{host}'s driveway"
  connection_route: 'ocpp' | 'enode'
  ocpp_charge_point_id  (nullable, if route = ocpp)
  enode_vehicle_id       (nullable, if route = enode)
  available: boolean
  created_at, removed_at (soft delete — see §6 on no-show/idle history)

Booking
  id, driver_id -> User, charger_id -> Charger
  arrival_at, end_at        (timestamps, not separate date/time — the
                              frontend's Date objects collapse cleanly here)
  status: 'upcoming' | 'active' | 'completed' | 'cancelled' | 'no_show'
  service_charge_paid: boolean  (£1.49, charged at booking time)
  created_at

Session
  id, booking_id -> Booking  (1:1)
  started_at, ended_at
  meter_start_kwh, meter_end_kwh    -- from the charger's own meter, per
                                        the "verified not estimated" model
  idle_started_at   (nullable — set once meter delta stops moving + 15 min)
  energy_cost, idle_cost, overstay_cost   -- computed, not stored redundant
                                              with rate at time of booking
  ended_reason: 'driver_ended' | 'released_early' | 'system_timeout'

Transaction
  id, booking_id -> Booking
  type: 'energy' | 'idle_occupancy' | 'overstay' | 'service_charge' | 'no_show_fee'
  gross_amount, commission_amount, host_net_amount
  stripe_payment_intent_id, stripe_transfer_id
```

The `Transaction` split (`gross_amount` / `commission_amount` /
`host_net_amount`) is deliberately shaped exactly like
`computeSessionFinancials`'s return value in the frontend — same fields,
same meaning, so a shared type isn't a stretch to introduce later.

---

## 3. Charger connectivity — OCPP + Enode behind one adapter

This is already specified in the product doc and shouldn't change:

- **`ChargerAdapter` interface** — `authorize(sessionId)`,
  `stop(sessionId)`, `getMeterValue(chargerId)` — implemented once per
  route, so booking/pricing logic never branches on which protocol a
  charger speaks.
- **OCPP 1.6-J route**: a WebSocket server holding long-lived connections
  per charge point. `MeterValues` messages update `Session.meter_end_kwh`
  in near-real-time; `StartTransaction`/`StopTransaction` map to
  session start/end. This is stateful infrastructure — needs to run as a
  long-lived process (not a serverless function), and needs a plan for
  reconnection if a charger drops offline mid-session (the meter keeps
  counting internally regardless, per the doc — the backend just needs to
  reconcile the final reading on reconnect, not lose the session).
- **Enode route**: REST calls for remote start/stop, either polling for
  meter updates or (better, if Enode supports it) subscribing to their
  webhook events for charging state changes.
- **Real-time to the app**: whichever route updates a session's meter
  reading, that needs to reach the driver's phone live. A WebSocket
  connection from app to backend (Socket.IO or plain `ws`, one connection
  per active session) is the natural fit here — this is the exact seam
  where `SessionContext`'s simulated `setInterval` in the RN app gets
  replaced with real server-pushed ticks.

**Practical recommendation**: don't build against real OCPP hardware or
real Enode credentials first. Build the `ChargerAdapter` interface and a
**mock/simulator implementation** of it that behaves like the existing
frontend simulation (predictable fake meter ticks), so the rest of the
backend (bookings, payments, the WebSocket bridge to the app) can be built
and tested end-to-end before real hardware integration — which the
product doc itself notes is still pending real Enode credentials and
founder hardware testing anyway.

---

## 4. Booking/session business rules

All of this logic already exists and was fought over in the frontend
build — the backend's job is to be the authoritative version of the same
rules, not invent new ones:

- **No-show**: if not plugged in within 20 minutes of booking start,
  auto-release the slot. A scheduled job (BullMQ or Nest's built-in
  `@nestjs/schedule`) checking upcoming bookings past their grace window.
- **Idle occupancy**: 15-minute grace period after the meter stops moving,
  then per-minute idle rate accrues until the booking's own end time —
  exactly the timeline built and tested in `computeSessionFinancials`.
- **Overstay**: 15-minute grace *after* the booking's end time, then the
  overstay rate applies until the driver actually ends the session.
- **Cancellation**: free >2 hours before arrival; otherwise the flat
  £1.49 service charge applies regardless of outcome.

These four rules are pure functions of timestamps and rates — genuinely
worth writing as backend logic that's unit-tested against the *exact* same
scenarios already worked through in this conversation (the 2:43pm →
3:00pm arrival buffer, the overnight rollover, the idle-vs-overstay
boundary), so the backend doesn't quietly reintroduce bugs that were
already found and fixed once.

---

## 5. Payments: Stripe Connect

This is the natural fit for a two-sided marketplace with automatic
commission splits:

- **Stripe Connect (Express accounts)** for hosts — Stripe handles the
  identity verification and payout compliance burden, which the product
  doc explicitly defers ("host verification" is in "Deliberately
  Deferred") — Connect Express gives you a reasonable default here without
  building it yourselves.
- **Destination charges with `application_fee_amount`**: driver's card is
  charged the full gross amount, Stripe automatically routes
  `gross - commission` to the host's connected account and the commission
  stays with the platform — this maps directly to the
  `hostNet`/commission split already computed in `pricing.ts`.
- **The no-show/late-cancellation fee (0% commission, 100% to host)** and
  the **flat £1.49 service charge (100% to Kelo)** are both just
  `application_fee_amount` set to 0 or the full amount respectively — the
  same Stripe primitive covers both cases the product doc specifies.

---

## 6. Suggested build order

Not everything at once — a sequence that gets something real and testable
early:

1. **Data model + auth + basic REST API** (users, chargers CRUD, bookings
   CRUD) — no real charger connection yet, no real payments yet.
2. **Mock `ChargerAdapter`** + WebSocket bridge to the app — swap the RN
   app's simulated `SessionContext` ticker for real (if fake) server-pushed
   session data. This is the point where frontend and backend are
   genuinely talking to each other.
3. **Stripe Connect integration**, test mode — real payment flow, fake
   money.
4. **Booking rules as scheduled jobs** (no-show, idle, overstay) running
   against the mock adapter.
5. **Real OCPP central system**, tested against a simulated charger first
   (the product doc says this already exists as a prototype) before real
   hardware.
6. **Real Enode integration**, pending the credentials the product doc
   flags as still outstanding.

Steps 1–4 can happen entirely without real hardware or real charger
credentials, which is most of the actual product logic.

---

## Open questions for you, not decisions I should make unilaterally

- **Hosting**: Railway/Render/Fly.io for something this size, or AWS/GCP
  from the start? Affects how the OCPP WebSocket server is deployed
  (needs a long-lived process, not pure serverless).
- **Monorepo or separate repos** for app + backend? A monorepo (e.g. with
  Turborepo) makes the shared `@kelo/core` package trivial; separate repos
  means versioning and publishing it properly.
- **How much of steps 5–6 (real OCPP/Enode) do you want scoped now** vs
  treated as a later phase once the mock-backed version is proven end to
  end?
