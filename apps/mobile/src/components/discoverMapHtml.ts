/**
 * The actual Leaflet map, as a standalone HTML document string — shared
 * verbatim between DiscoverMap.tsx (native, hosted in a react-native-webview
 * WebView) and DiscoverMap.web.tsx (react-native-web has no web
 * implementation of react-native-webview at all — confirmed by its own
 * package contents, no .web.* files — so the web target hosts this exact
 * same HTML in a plain <iframe> instead, the direct web equivalent of what
 * WebView provides natively). One HTML/JS implementation, two hosts — never
 * two different maps to keep in sync.
 *
 * The document is static and self-contained: it takes no charger/location
 * data at construction time. All real data (chargers, device location,
 * selection, theme) arrives after load via postMessage, so the page itself
 * never needs regenerating/reloading when that data changes — see the
 * "keep the WebView warm" requirement this exists to satisfy. initialMode
 * is the one exception: baked in at construction so the very first paint
 * already matches the app's current theme instead of flashing the wrong
 * one before a postMessage can arrive.
 *
 * Tile source: CARTO's raster basemaps — Dark Matter for dark mode,
 * Positron for light mode, both under the one free API key (checked live,
 * 2026-09: both `dark_all` and `light_all` return real 200 tiles with the
 * same key, no separate product/plan — confirmed by diffing a keyed vs
 * unkeyed Positron tile, same as the original Dark Matter check: unkeyed
 * comes back watermarked "API KEY REQUIRED", keyed doesn't). Still no
 * account needed beyond the free key itself, 5M tile requests/month
 * fair-use free tier either way. Live theme switching uses
 * L.TileLayer.setUrl() — a real documented Leaflet method for swapping a
 * layer's source in place — rather than tearing down and recreating the
 * layer.
 *
 * Attribution: CARTO's basemap terms (checked live at carto.com/legal/
 * basemap-terms and carto.com/attributions, 2026-09) require CARTO +
 * OpenStreetMap to be credited, "prominent and conspicuous", not obscured
 * — but specify no required font size, color, or exact positioning beyond
 * that. Leaflet's own default attribution control (light background, dark
 * text) is a Leaflet styling default, not a CARTO requirement — restyled
 * below to fit each theme (dark-on-light-map, light-on-dark-map) while
 * keeping the same text/links, same size class, same corner, never
 * hidden — content and prominence unchanged, only its chrome.
 */
export function buildMapHtml(cartoApiKey: string, initialMode: "light" | "dark" = "dark"): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<!-- user-scalable=no + maximum-scale=1.0: the page itself must never
     native-pinch-zoom or double-tap-zoom — Leaflet owns 100% of zoom
     gesture handling itself, see the smoothness requirement this
     satisfies. Without this, the browser/WebView's own native zoom and
     Leaflet's JS-driven zoom would fight over the same gesture. -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
  html, body, #map { background: #12161C; }
  html[data-theme="light"] body, html[data-theme="light"] #map { background: #E5E7EB; }
  /* touch-action: none on the map container is what actually keeps the
     browser's own native touch-scroll/touch-zoom handling out of the way
     entirely, leaving every touch event free for Leaflet's own gesture
     code to interpret — the other half of the "Leaflet owns all gesture
     handling" requirement (the other half being scrollEnabled={false} on
     the native WebView / no scrolling on the outer iframe body). */
  #map { touch-action: none; }
  .kelo-pin { display:flex; flex-direction:column; align-items:center; pointer-events:none; }
  .kelo-pin svg { display:block; }
  .kelo-pin-label {
    margin-top: 2px; font-family: ui-monospace, monospace; font-size: 9.5px; color: #8891A0;
    background: #12161C; padding: 1px 5px; border-radius: 4px; white-space: nowrap;
  }
  .kelo-you-dot {
    width: 14px; height: 14px; border-radius: 7px; background: #4FD8C4;
    border: 2px solid #12161C; box-shadow: 0 0 0 4px rgba(79,216,196,0.25);
  }
  /* Attribution restyle — same text/links/corner/size class Leaflet
     already renders, just recolored per theme so it doesn't sit as a
     bright white bar on the dark map (or, once light mode existed, a
     mismatched dark bar on the light one). Nothing here shrinks it below
     Leaflet's own default font-size or hides/obscures it.
     leaflet.css itself sets background under the more specific
     ".leaflet-container .leaflet-control-attribution" (its color rule is
     on the plain single-class selector) — matched here, confirmed live
     against a real page rather than assumed, after a first attempt at
     just ".leaflet-control-attribution" silently lost the background
     override to that more specific rule while the color override (same
     specificity as Leaflet's) won. */
  .leaflet-container .leaflet-control-attribution {
    background: rgba(18,22,28,0.72);
  }
  .leaflet-control-attribution { color: #8891A0; }
  .leaflet-control-attribution a { color: #B7C9C5; }
  html[data-theme="light"] .leaflet-container .leaflet-control-attribution {
    background: rgba(255,255,255,0.75);
  }
  html[data-theme="light"] .leaflet-control-attribution { color: #57606A; }
  html[data-theme="light"] .leaflet-control-attribution a { color: #2C5F58; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var CARTO_KEY = ${JSON.stringify(cartoApiKey)};
  var INITIAL_MODE = ${JSON.stringify(initialMode)};
  document.documentElement.setAttribute('data-theme', INITIAL_MODE);

  // Fallback center: same Carshalton (SM5) centroid the backend's
  // DEFAULT_SEARCH_ORIGIN uses when no real device location is available
  // — kept in sync deliberately (see DiscoverMap.tsx's own comment), not
  // derived automatically, since this is JS running in an isolated
  // WebView/iframe with no import access to the backend package.
  var FALLBACK_CENTER = [51.36874869252465, -0.16896046685472493];

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    center: FALLBACK_CENTER,
    zoom: 13,
    // Gesture/animation tuning beyond Leaflet's plain defaults — real
    // documented Map options (leafletjs.com/reference.html), each
    // deliberately chosen, not left at whatever Leaflet happens to ship:
    //  - inertiaDeceleration: lower than the 3000 default (px/s^2) means
    //    a flick coasts a bit further/longer before stopping, closer to
    //    the native-feeling glide of Apple/Google Maps than an abrupt
    //    stop.
    //  - inertiaMaxSpeed: Leaflet's own default is Infinity (uncapped) —
    //    a hard, fast flick on a small-content map like this one can
    //    otherwise fling you disorientingly far in one gesture. Capped,
    //    not left unbounded.
    //  - zoomSnap/zoomDelta at 0.5 instead of the default 1: pinch-zoom
    //    lands on the fractional level closest to where the gesture
    //    actually ended, instead of always snapping to the next whole
    //    integer — raster tiles still render fine at fractional zoom
    //    (Leaflet CSS-scales the nearest whole tile set), so this is a
    //    real smoothness gain with no rendering cost.
    //  - tapTolerance raised from the 15px default: a small, deliberate
    //    allowance for finger jitter when tapping a charger pin (a real
    //    driver-facing use case, not a desktop pointer) before Leaflet's
    //    touch handler reclassifies the gesture as a drag instead of a
    //    tap.
    inertia: true,
    inertiaDeceleration: 2500,
    inertiaMaxSpeed: 3000,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    tap: true,
    tapTolerance: 20,
  });

  function tileUrlFor(mode) {
    var style = mode === 'light' ? 'light_all' : 'dark_all';
    return 'https://basemaps.cartocdn.com/rastertiles/' + style + '/{z}/{x}/{y}.png?key=' + encodeURIComponent(CARTO_KEY);
  }

  var tileLayer = L.tileLayer(tileUrlFor(INITIAL_MODE), {
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  function post(message) {
    var payload = JSON.stringify(message);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      // Native host (react-native-webview).
      window.ReactNativeWebView.postMessage(payload);
    } else if (window.parent && window.parent !== window) {
      // Web host (plain <iframe> — DiscoverMap.web.tsx).
      window.parent.postMessage(payload, '*');
    }
    window.__kelo.bridgeMessageCount++;
  }

  function pinIcon(selected) {
    var size = selected ? 30 : 24;
    var fill = selected ? '#4FD8C4' : 'rgba(79,216,196,0.12)';
    var stroke = '#4FD8C4';
    var svg =
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="' + fill + '"/>' +
      '<circle cx="12" cy="10" r="3"/>' +
      '</svg>';
    return L.divIcon({
      className: 'kelo-pin',
      html: svg,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });
  }

  var chargerMarkers = {}; // chargerId -> L.Marker
  var selectedId = null;
  var youMarker = null;

  // -- RN/iframe -> map: each message type fires once per real change (a
  // fresh chargers list, a real device-location update, a tap-driven
  // selection change, a real theme toggle) — never anything tied to the
  // pan/zoom gesture loop itself. This function only ever RECEIVES;
  // nothing in here posts back out, keeping the bridge one-directional
  // per event.
  function applyMessage(msg) {
    if (msg.type === 'setChargers') {
      Object.keys(chargerMarkers).forEach(function (id) {
        map.removeLayer(chargerMarkers[id]);
      });
      chargerMarkers = {};
      msg.chargers.forEach(function (c) {
        var marker = L.marker([c.lat, c.lng], { icon: pinIcon(String(c.id) === String(selectedId)) });
        marker.on('click', function () {
          // Leaflet's own Marker default (bubblingMouseEvents: false)
          // already stops this click from also reaching the map's own
          // 'click' handler below — no manual stopPropagation needed,
          // confirmed against Leaflet's own source rather than assumed.
          post({ type: 'pinTap', chargerId: c.id });
        });
        marker.addTo(map);
        chargerMarkers[c.id] = marker;
      });
    } else if (msg.type === 'setDeviceLocation') {
      if (youMarker) {
        map.removeLayer(youMarker);
        youMarker = null;
      }
      if (msg.lat != null && msg.lng != null) {
        youMarker = L.marker([msg.lat, msg.lng], {
          icon: L.divIcon({
            className: 'kelo-pin',
            html: '<div class="kelo-you-dot"></div><div class="kelo-pin-label">You</div>',
            iconSize: [40, 30],
            iconAnchor: [20, 15],
          }),
          zIndexOffset: -1000, // chargers stay tappable above it, same layering intent as the old stylized map
          interactive: false,
        }).addTo(map);
      }
    } else if (msg.type === 'setSelected') {
      var newId = msg.chargerId != null ? String(msg.chargerId) : null;
      if (selectedId != null && chargerMarkers[selectedId]) {
        chargerMarkers[selectedId].setIcon(pinIcon(false));
      }
      selectedId = newId;
      if (selectedId != null && chargerMarkers[selectedId]) {
        chargerMarkers[selectedId].setIcon(pinIcon(true));
      }
    } else if (msg.type === 'setCenter') {
      map.setView([msg.lat, msg.lng], map.getZoom());
    } else if (msg.type === 'setTheme') {
      // Live theme switch, not just an initial-paint concern — setUrl()
      // is Leaflet's own real method for swapping a tile layer's source
      // in place (confirmed against Leaflet's TileLayer docs), so this
      // updates the already-mounted, already-warm map/WebView instance
      // directly rather than requiring a reload of this whole document.
      var mode = msg.mode === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', mode);
      tileLayer.setUrl(tileUrlFor(mode));
    }
  }

  map.on('click', function () {
    post({ type: 'backgroundTap' });
  });

  function onIncoming(event) {
    var data = event.data;
    if (typeof data !== 'string') return;
    var msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return;
    }
    applyMessage(msg);
  }
  // react-native-webview's .postMessage() dispatches a 'message' event on
  // *window* on iOS and on *document* on Android (checked directly
  // against its own native source this session — apple/RNCWebViewImpl.m
  // and android/.../RNCWebViewManagerImpl.kt — since an earlier version
  // of this comment had the two platforms backwards; that inaccuracy
  // never actually broke anything only because both targets are listened
  // on here regardless of platform). DiscoverMap.tsx (native) no longer
  // actually goes through this path at all — see window.__kelo.
  // applyMessage above, which it calls directly via injectJavaScript
  // instead — but this listener is kept for exactly the plain-iframe web
  // host below, which has no injectJavaScript equivalent and still posts
  // via window.postMessage (only ever arrives on window, covered by the
  // same window listener).
  document.addEventListener('message', onIncoming);
  window.addEventListener('message', onIncoming);

  // applyMessage exposed directly — the native host (DiscoverMap.tsx)
  // calls this straight via injectJavaScript() instead of going through
  // the postMessage/MessageEvent/addEventListener indirection below.
  // Real, checked reason: react-native-webview's .postMessage() and
  // .injectJavaScript() are the same underlying native call in this
  // library (confirmed against its own source — postMessage's iOS/
  // Android implementations both just build a MessageEvent-dispatching
  // script string and run it exactly the way injectJavaScript runs any
  // other script), so this doesn't change *whether* the native bridge
  // delivers — it removes the MessageEvent construction/dispatch/
  // listener-matching indirection as one more moving part, calling
  // straight into the same function the message-event listener below
  // would have called anyway. The web host (DiscoverMap.web.tsx) has no
  // injectJavaScript equivalent for a plain <iframe>, so it still goes
  // through postMessage — both paths end up at this same function.
  //
  // Diagnostics surface for automated verification (Playwright, run
  // against the web/.web.tsx host where the map's DOM is directly
  // reachable) — real, inspectable evidence rather than an assumption:
  // any3d reports whether Leaflet actually detected 3D-transform support
  // (and therefore uses translate3d/CSS3-transform panning, not the
  // legacy left/top positioning fallback); bridgeMessageCount is
  // incremented exactly once per post() call above, so a test can sample
  // it before/after a simulated drag and confirm it did not increase
  // mid-gesture; currentTheme/currentTileUrl let a test confirm a theme
  // switch actually reached the tile layer, not just the DOM attribute.
  window.__kelo = {
    bridgeMessageCount: 0,
    applyMessage: applyMessage,
    getDiagnostics: function () {
      var pane = document.querySelector('.leaflet-map-pane');
      return {
        any3d: L.Browser.any3d,
        mapPaneTransform: pane ? pane.style.transform : null,
        bridgeMessageCount: window.__kelo.bridgeMessageCount,
        chargerMarkerCount: Object.keys(chargerMarkers).length,
        currentTheme: document.documentElement.getAttribute('data-theme'),
        currentTileUrl: tileLayer.getAttribution ? tileLayer._url : null,
        zoom: map.getZoom(),
      };
    },
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
