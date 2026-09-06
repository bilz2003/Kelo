# Discover map: real Leaflet map, real data

Discover's map view is now a real, geographically accurate Leaflet map —
replacing `POSTCODE_COORDS`/`pinPosition` (a stylized, illustrative
postcode-lookup table with no real coordinates behind it) entirely, not
alongside it.

## Approach

A Leaflet map, running as a small self-contained HTML/JS document
([`discoverMapHtml.ts`](apps/mobile/src/components/discoverMapHtml.ts)),
hosted inside a `react-native-webview` `WebView` on native
([`DiscoverMap.tsx`](apps/mobile/src/components/DiscoverMap.tsx)) — the
standard way to get a real map into an Expo Go app without a custom dev
client, since `react-native-webview` is one of the native modules Expo Go
itself ships. `react-native-webview` has no web implementation at all
(confirmed against its own package — no `.web.*` files present), so the
web platform gets its own override,
[`DiscoverMap.web.tsx`](apps/mobile/src/components/DiscoverMap.web.tsx),
hosting the *identical* HTML in a plain `<iframe>` instead — the direct
web equivalent, using the same `postMessage`/message-event bridge
semantics. One map implementation, two hosts, picked up automatically by
Metro's platform-extension resolution (the same mechanism
`secureStorage.web.ts` already established in this codebase).

## Tile provider

Chosen deliberately, not defaulted to: CARTO's **Dark Matter** raster
basemap — the standard choice for a dark UI, and it gets close to Kelo's
own ink/surface/cyan palette out of the box (its own base colors) without
needing custom style tuning, which CARTO's raster tier doesn't expose
knobs for anyway (that level of control is on their vector service, a
bigger integration than this needed).

**Checked current terms live (2026-09), not assumed unchanged**: CARTO
started requiring a free API key on `basemaps.cartocdn.com` as of
~2026-08 — the old no-auth convention some tutorials still describe no
longer works; a keyless request now returns a real, validly-formatted
tile image with "API KEY REQUIRED" watermarked across it (confirmed live
during this build, before a real key was available — see the verification
section). Still no CARTO account needed for the key itself: a one-time
form (email, domain, short project description) at
carto.com/basemaps/apikey, key emailed back instantly, free up to 5M tile
requests/month. Attribution (CARTO + OpenStreetMap) is a real license
condition, not a courtesy — Leaflet's attribution control is left on and
never suppressed. The exact current URL and terms were fetched live
against CARTO's own docs and cross-checked, not carried over from
training-data memory of the old convention.

Set `EXPO_PUBLIC_CARTO_API_KEY` in `apps/mobile/.env` (see that file's own
comment for the signup link). Without a real key the map still fully
functions — markers, real positions, pan/zoom, the pin-tap bridge — only
the tile *images* show the watermark instead of the real basemap.

**Honest caveat for later**: CARTO's own docs flag raster tiles (the
scheme used here) as being phased toward eventual retirement in favor of
their vector tile service, with no fixed date given. Not urgent — raster
tiles work today and are what this integration uses — but a real,
non-hypothetical thing to revisit later, not treated as settled forever.

## Real data

- **Chargers**: `Charger.lat`/`lng` — added to `@kelo/core`'s shared
  `Charger` type (previously absent entirely; the real geocoded
  coordinates existed server-side via `GeocodingService` but had never
  been threaded through to this view-model type) and populated in
  `mapDiscoverCharger`/`mapOwnerCharger`. `DiscoverMap` sends chargers to
  the map with their real `lat`/`lng` — no lookup table, no
  illustrative/approximate placement.
- **"You" marker**: wired to the real device location from the
  location-permission work
  ([`apps/mobile/src/lib/location.ts`](apps/mobile/src/lib/location.ts))
  — `DiscoverListScreen`'s already-resolved `coords` state is passed
  straight through as `DiscoverMap`'s `deviceLocation` prop. A real,
  moving position when granted; no marker at all when denied/unavailable
  (more honest than a fabricated fixed dot).

## Preserved interaction

Tapping a pin still opens the **same** pricing bottom sheet that already
lived in `DiscoverListScreen.tsx` (there was never a separate extracted
component for it) — untouched. The map only ever sends a `chargerId` back
over the bridge on tap; `DiscoverListScreen` looks up the matching
`Charger` it already has in its own `chargers` array and calls the exact
same `onPinTap`/`setMapPinSelected` it always did. No pricing/display
logic was duplicated into the WebView.

## The five smoothness optimizations — what was actually done

1. **Leaflet owns all gesture handling, WebView's native handling fully
   disabled**: `scrollEnabled={false}`, `bounces={false}`,
   `overScrollMode="never"`, `nestedScrollEnabled={false}` on the native
   `WebView`; `user-scalable=no, maximum-scale=1.0` in the page's own
   viewport meta tag, plus `touch-action: none` on the map container in
   its CSS — both halves (native host config + page-level config)
   needed, neither alone is sufficient.
2. **CSS3-transform-based panning confirmed active, not assumed**:
   checked live via the map's own `L.Browser.any3d` flag and the actual
   computed `transform` style Leaflet applies to `.leaflet-map-pane`
   during a real pan — see verification below for the real captured
   values (`any3d: true`, a real `translate3d(...)` string that changed
   with each pan).
3. **WKWebView on iOS / hardware acceleration on Android, checked not
   assumed**: confirmed against the installed `react-native-webview`
   package's own source that iOS has no `UIWebView` code path at all
   (WKWebView is the only implementation). `androidLayerType="hardware"`
   set explicitly — checked against `RNCWebViewManagerImpl.kt` that
   leaving this unset resolves to `LAYER_TYPE_NONE`, not
   `LAYER_TYPE_HARDWARE`, so this is a real, meaningful change rather
   than restating an existing default.
4. **Bridge throttled to discrete events only**: the map only ever posts
   a message on a marker tap or an empty-map tap — by design, there is no
   pan/zoom/move handler that posts anything at all, so there is nothing
   to throttle in the usual debounce sense. Verified for real: the
   bridge's own message counter did not increase across an entire
   simulated pan-and-zoom gesture (see verification below).
5. **WebView instance stays warm across navigation**: `DiscoverListScreen`
   keeps `DiscoverMap` permanently mounted regardless of List/Map toggle
   (or the loading/error/empty states) — visibility toggles via a plain
   `display` style on an absolutely-positioned wrapper, not conditional
   mounting. The HTML document itself is also built once and never
   regenerated; all real data changes (chargers, location, selection)
   arrive after load via `postMessage`, not by reloading the page.

## Removed entirely

`apps/mobile/src/utils/map.ts` (`POSTCODE_COORDS`, `pinPosition`) —
deleted, not left dead alongside the new implementation. The old
hand-rolled `PanGestureHandler`/`react-native-svg` grid-line panning code
that lived in the previous `DiscoverMap.tsx` is gone with the full
rewrite; both packages remain project dependencies (used elsewhere in the
app) but `DiscoverMap` no longer imports either.

## Verification

Run against the project's own established web-preview + Playwright
pipeline (`TESTING.md`) — genuinely real verification here, not a
workaround, since the map itself is web content (HTML/CSS/JS) regardless
of which host (native `WebView` or web `<iframe>`) it runs inside; the
`.web.tsx` variant is what makes this pipeline able to reach it at all.

- **Real chargers at real positions, real "You" marker**: three test
  chargers created at genuinely distinct, real geocoded postcodes
  (Carshalton SM5, central London WC2N, Croydon CR0). With a real
  injected device location near central London (via Playwright's real
  geolocation injection, not a fixed test value), the map correctly
  showed only the one charger within the default 5mi radius — the
  Carshalton and Croydon chargers are genuinely >5mi from that point, so
  their absence is the *distance computation itself* working correctly
  end to end (real device location → real backend haversine → real
  radius filter → real map marker), not a display bug. The visible
  charger's marker rendered at its own real `lat`/`lng`, and a real "You"
  marker appeared at the real injected device coordinates. `any3d: true`
  and a real `translate3d(...)` map-pane transform were both read
  directly from the live page, confirming point 2 above with real values
  rather than an assumption.
- **Pin tap → existing pricing sheet**: tapping the real map marker
  (via Leaflet's own click handling, not a synthetic bridge call)
  correctly opened the same pricing sheet already used everywhere else in
  Discover, populated with that charger's real data — confirmed both via
  DOM text extraction (host name, title, postcode, connector, cable,
  power, distance, all four pricing rows) and a screenshot.
- **Smoothness optimizations, checked at the code level**: all five
  confirmed as actually implemented (specific prop values, specific
  config checked against the installed package's own source, specific
  CSS/meta present in the generated HTML), not just "present in some
  form" — see the numbered list above for exactly what was checked for
  each.
- **Real frame-timing data during a simulated pan/zoom** (captured via a
  `requestAnimationFrame` interval sampler and a `PerformanceObserver`
  for Long Tasks, both running inside the map's own frame, started before
  and read back after a scripted drag + wheel-zoom gesture):
  - 94 frames sampled across the gesture window.
  - Average frame interval: 16.67ms (i.e., essentially exactly 60fps).
  - Maximum frame interval: 16.8ms — no real outliers or stalls.
  - Zero Long Tasks (main-thread blocks >50ms) during the entire
    gesture.
  - A naive "frames over 16.7ms" count came out to 12 (12.8%) — but given
    the max frame interval was only 16.8ms, this reflects normal
    sub-millisecond vsync jitter at the exact 60fps boundary, not real
    jank; the average/max/long-task numbers are the meaningful signal
    here, reported alongside this one rather than left to stand alone
    unexplained.
  - The bridge's own message counter (`window.__kelo.bridgeMessageCount`)
    was identical before and after the entire gesture — zero messages
    fired mid-pan/zoom, direct, real confirmation of point 4 above.

**What this does and doesn't prove.** The frame-timing and Long Task data
above are real, meaningful signal — genuinely more than "should feel
better." They are not, and are not being claimed as, a full substitute
for a human actually holding the app and judging whether it feels
native-smooth in practice. That's a real, separate, unavoidably subjective
judgment this kind of testing cannot make on anyone's behalf — stated
here plainly rather than folded into "verified as smooth."

**Tile rendering — fully confirmed, including with a real key.** Before a
real `EXPO_PUBLIC_CARTO_API_KEY` was available, tile requests were already
confirmed reaching CARTO's real server and returning a real, correctly
dark-themed, correctly-attributed response — just watermarked "API KEY
REQUIRED" in that state. Once a real key was set, the same pipeline was
re-run: all 9 tile requests for the loaded viewport returned real `200
image/png` responses (`naturalWidth: 256`, genuine loaded images, not
broken placeholders), and a screenshot confirmed the watermark is gone —
real street names and geography visible (Marylebone Road, the Thames,
City of Westminster), correctly dark-themed, correct attribution row,
with the real charger pin and real "You" marker both still correctly
positioned on top of it.

## Light/dark theme following (2026-09)

The map now follows the app's Account > Appearance toggle instead of
always rendering Dark Matter. Confirmed live, not assumed, before
building this: CARTO's Positron style (`rastertiles/light_all`) works
under the exact same free API key as Dark Matter (`rastertiles/dark_all`)
— same host, same key, same 5M/month fair-use tier, no separate
product/plan. Verified the same way the original Dark Matter key
enforcement was verified: diffed a keyed vs. unkeyed Positron tile
request — different bytes, different MD5, and the unkeyed one visibly
shows the "API KEY REQUIRED" watermark while the keyed one is a clean
real basemap.

Switching is live, not just on next load: `buildMapHtml` bakes the
*initial* theme in (so first paint already matches, no flash), but a
theme change while the map is already open reaches it through the same
postMessage bridge everything else uses (`{ type: 'setTheme', mode }`),
handled by calling Leaflet's own `TileLayer.setUrl()` — a real documented
method for swapping a layer's tile source in place, not a
teardown/recreate. Confirmed directly: toggling the theme from the
Account tab (map not even visible at that moment, just still mounted
behind it) fires real tile requests for the new style immediately, before
ever navigating back to Discover.

## Attribution — checked CARTO's actual current terms first

Checked `carto.com/legal/basemap-terms` and `carto.com/attributions`
directly (2026-09) before changing anything. What's actually required:
CARTO and OpenStreetMap must be credited, "prominent and conspicuous,"
not obscured — enforced (an API key can be suspended/revoked for
non-compliance). What's *not* specified anywhere in their terms: any
required font size, color, or exact position. Leaflet's own default
attribution styling (white background, dark text, bottom-right) is a
Leaflet default, not a CARTO mandate.

On that basis, the control is now restyled per theme — dark
semi-transparent background + muted light text on the dark map, light
semi-transparent background + muted dark text on the light map — same
text, same links, same corner, same font-size, never hidden. (One real
snag hit and fixed along the way: `leaflet.css` sets the control's
*background* under the more specific `.leaflet-container
.leaflet-control-attribution` selector while its *color* rule is on the
plain single-class selector — an initial restyle attempt matched the
plain selector for both properties, so the color override won but the
background override silently lost to Leaflet's own more-specific rule.
Confirmed via a live computed-style check, not assumed, then fixed by
matching that same specificity.)

## The theme-live-update gap Playwright couldn't have caught (2026-09)

Reported: theme-following didn't actually update the map on a real
device, despite the previous round's Playwright verification calling it
"confirmed live." Diagnosed before touching anything:

**Definitive, provable fact**: Playwright's testing runs against
`expo start --web`, and Metro's platform-extension resolution
*guarantees* the web bundle uses `DiscoverMap.web.tsx` (the `<iframe>` +
`window.postMessage` host) — `DiscoverMap.tsx` (the real
`react-native-webview` host) cannot even be included in a web bundle,
since that package has no web implementation at all. So the previous
"confirmed live" claim was true for the web host and said *nothing*
whatsoever about the native one — not a near-miss, a complete blind
spot by construction. This part didn't need a device to establish; it
follows directly from how the two files are wired.

**Checked, not assumed**: whether `react-native-webview`'s native bridge
mechanism itself was actually sound. Read its own source
(`node_modules/react-native-webview`, v13.16.1) directly:
- Found and fixed a real doc-comment error: this file used to claim
  message-events land on `document` on iOS / `window` on Android — the
  *opposite* of what the native source actually does (iOS:
  `RNCWebViewImpl.m`'s `postMessage:` dispatches on `window`; Android:
  `RNCWebViewManagerImpl.kt`'s dispatches on `document`). Never actually
  broke anything, purely because both targets were already listened on
  regardless of platform — but wrong is wrong, corrected in the code.
- More importantly: `.postMessage()` and `.injectJavaScript()` are **the
  same underlying native call** in this library version. postMessage's
  own iOS implementation is literally `[self injectJavaScript:
  "window.dispatchEvent(new MessageEvent(...))"]`; its Android
  implementation calls the exact same `evaluateJavascriptWithFallback`
  injectJavaScript itself calls. So switching to injectJavaScript, on
  its own, could not have been "the fix" — there's no reliability gap
  between the two to close that way, and claiming otherwise would have
  been cosmetic, not a real fix.

**What actually changed**, then, given switching APIs alone proves
nothing: native (`DiscoverMap.tsx`) now calls
`window.__kelo.applyMessage(...)` directly via `injectJavaScript`
instead of building a MessageEvent and dispatching it — same native
transport, one less layer of event-dispatch/listener-matching
indirection to go wrong. And, the part that's a genuine, provable fix
regardless of whatever the real underlying platform behavior turns out
to be: the `'ready'` resync handshake never included the current theme
(only chargers/location/selection) — meaning if the page ever
reinitializes after its first paint for *any* reason (a real, if
unconfirmed-on-this-device, category of behavior for
`react-native-webview` combined with `react-native-screens`' default
view-detachment for inactive tabs), it would come back on whatever
theme was active at the very first app launch, permanently, with no
mechanism to self-correct. Fixed by including theme in every `'ready'`
burst, and — the most robust piece — by re-pushing the *entire* current
state (chargers, location, selection, theme) every time this screen
regains focus via `useFocusEffect`, the same pattern already used for
`DiscoverListScreen`'s own charger refetch. This closes the gap
regardless of the exact underlying cause: even if every single
live-while-hidden push were silently dropped for a reason this
investigation couldn't pin down without a device, the map is
guaranteed correct again the moment it's actually looked at.

**Honest limit, stated plainly**: none of the above could be exercised
against the real native bridge — no iOS Simulator or Android emulator
is available in this environment, and Playwright cannot touch
`DiscoverMap.tsx` at all (see above). Everything here is verified as
far as it's possible to verify without a device: the code compiles, the
web host (proven to share the identical HTML/message-handling logic)
still updates live with no regression, and the mechanistic claims about
`postMessage`/`injectJavaScript` are backed by reading the installed
package's own source rather than assumed. Whether this actually
resolves it on a real phone is **not confirmed** and cannot honestly be
claimed as confirmed from here — that needs the person reading this to
test it on their own device.

## Gesture tuning beyond the original build (2026-09)

Re-examined Leaflet's own Map options (leafletjs.com/reference.html) for
further gesture/animation tuning, each a deliberate, documented choice:

- `inertiaDeceleration: 2500` (down from Leaflet's 3000 default) — a
  flick coasts a bit further before stopping.
- `inertiaMaxSpeed: 3000` (Leaflet's own default is uncapped/Infinity) —
  caps how far a single hard flick can fling the view on a map this
  small.
- `zoomSnap` / `zoomDelta: 0.5` (default 1) — pinch/wheel zoom lands on
  the nearest half-level instead of always rounding to a whole integer.
  Confirmed live: a scripted wheel-zoom sequence produced real zoom
  levels of 13, 13.5, 14, 14.5, 15, 15.5 — genuinely fractional, not
  just configured.
- `tapTolerance: 20` (default 15) — more forgiving of finger jitter when
  tapping a small charger pin.

Re-captured the same frame-timing method as the original smoothness work
(an rAF interval sampler + a `PerformanceObserver` for Long Tasks, both
running inside the map's own frame across a scripted drag+wheel-zoom
gesture), as a genuine before/after rather than a single after-only
number — Leaflet's plain defaults temporarily restored, tested, then the
tuned values restored and re-tested:

|  | avg frame | max frame | frames >16.7ms | Long Tasks |
|---|---|---|---|---|
| Before (Leaflet defaults) | 16.66ms | 16.8ms | 25/102 (24.5%) | 0 |
| After (tuned) | 16.67ms | 16.8ms | 14/102 (13.7%) | 0 |

Both were already essentially exactly 60fps before touching anything —
the original build's rendering pipeline (translate3d panning, hardware
compositing) left little raw frame-rate headroom to gain. The frames->16.7ms
share did drop meaningfully, though with max frame time unchanged in
both runs this mostly reflects reduced vsync-boundary jitter rather than
eliminated jank — reported honestly rather than oversold. The real,
distinctly-checkable gain from this round is gesture *feel* (glide
distance, zoom-landing precision, tap forgiveness), which frame-timing
alone doesn't fully capture. **Stated plainly, same as the original
smoothness work: this data is real signal, not a substitute for someone
actually holding the app and judging whether it feels right.**
