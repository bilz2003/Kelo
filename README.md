# Kelo — React Native (Expo) port

A real, compiling React Native + TypeScript port of the Kelo design prototype,
built via Expo. This is source code you run yourself — it wasn't compiled or
tested on a real device/simulator from within the environment this was
written in, but the project **does install cleanly and pass a full
`tsc --noEmit` type-check against the actual installed dependency versions**
(not just a syntax check) before being handed over.

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) for the fastest way to see it
running, or press `i` / `a` in the terminal for a simulator/emulator if you
have Xcode / Android Studio set up locally.

## What's fully ported and working

- **Theme system** (`src/theme`) — the exact dark/light token pairs from the
  web prototype, including the constraint that both modes reuse the same 8
  brand colours (no new colours introduced for light mode).
- **The core driver loop**: Discover list → Charger Detail → Booking Flow
  (exact date + time pickers, the next-full-hour arrival buffer, the
  overnight "done by" rollover fix, the 1-hour minimum booking length) →
  Booking Confirmed (real address reveal + Get Directions) → Active Session.
- **Live session state** (`src/state/SessionContext.tsx`) — lifted to the
  app root so it survives navigating away/minimizing, exactly like the
  web version's fix. Both the driver's live screen and the host's
  "Charging now" card in My Chargers read from the *same* ticking state via
  the *same* `computeSessionFinancials` function, so they can never
  silently disagree — including the gross (driver-charged) vs net
  (host-received, after Kelo's commission) split that was a real bug caught
  and fixed during the web build.
- **Host-side state** (`src/state/ChargerStoreContext.tsx`) — custom listing
  names with auto-disambiguation for duplicate names, per-charger price
  overrides, add/remove chargers with id-reuse protection.
- **Shared domain types** (`src/types/index.ts`) — this is the contract a
  real backend should implement against. `Charger`, `Booking`,
  `SessionFinancials` etc. are written to be the seed of a shared
  TypeScript package between this app and a Node/TypeScript backend, which
  was the whole point of choosing this stack.

## What's deliberately deferred, not faked

Being upfront about gaps rather than papering over them with something that
only looks finished:

- **The draggable map view with pin clustering** (Discover's Map tab in the
  web version) needs `react-native-maps` (or Mapbox) plus real geocoding.
  Worth its own task rather than a fake static image standing in for a map.
- **Photo upload + the pinch-to-zoom photo viewer** on Add/Edit Charger and
  Charger Detail needs `expo-image-picker` for capture/upload and
  `react-native-gesture-handler` + `react-native-reanimated` for a real
  native pinch gesture (the web version used raw browser touch events,
  which don't exist the same way in RN).
- **The full Add/Edit Charger flow** (model picker, pricing fields, remove
  confirmation) exists in the web version but wasn't ported in this pass —
  My Chargers currently shows the listing + live session card only.
- **Bookings' date-range filter** is stubbed to "this month" — the
  `TimeFilterButton` component (month list / custom calendar, shared with
  the pricing rate fields elsewhere) needs porting as a reusable component
  rather than being duplicated per-screen.
- **Push notifications, real payments (Stripe), and the actual OCPP/Enode
  meter feed** are backend-dependent and out of scope until that's wired up
  — `SessionContext`'s simulated tick is exactly the seam where a real
  websocket/polling feed from the backend would plug in.

## Next step for the backend

Since the whole reason for choosing React Native + TypeScript was to share
code with a future Node/TypeScript backend: the types in `src/types/index.ts`
and the pure functions in `src/utils/pricing.ts` and `src/utils/dateTime.ts`
have no React or React Native dependencies at all — they're plain
TypeScript. That makes them straightforward to extract into a shared
`@kelo/core` package once the backend exists, so both sides import the same
`computeSessionFinancials`, the same `Charger` type, and can never drift
apart the way two independent implementations could.
