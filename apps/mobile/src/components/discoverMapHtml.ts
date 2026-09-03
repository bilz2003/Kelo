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
 * selection) arrives after load via postMessage, so the page itself never
 * needs regenerating/reloading when that data changes — see the "keep the
 * WebView warm" requirement this exists to satisfy.
 *
 * Tile source: CARTO's Dark Matter raster basemap — chosen deliberately
 * (checked current terms live, 2026-09, rather than assuming the old
 * no-auth convention still held): CARTO now requires a free API key on
 * basemaps.cartocdn.com (enforced since ~2026-08), still no account
 * needed, 5M tile requests/month fair-use free tier, and requires CARTO +
 * OpenStreetMap attribution to stay visible on the map — implemented below
 * via Leaflet's own attribution control (left on, never suppressed).
 * Get a key at https://carto.com/basemaps/apikey and set
 * EXPO_PUBLIC_CARTO_API_KEY in apps/mobile/.env. Raster tiles are flagged
 * by CARTO as being phased toward eventual retirement in favor of their
 * vector service (no fixed date given) — noted honestly in
 * MAP-INTEGRATION.md as a real, if not urgent, future consideration.
 */
export function buildMapHtml(cartoApiKey: string): string {
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
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #12161C; }
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
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var CARTO_KEY = ${JSON.stringify(cartoApiKey)};
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
  });

  L.tileLayer('https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=' + encodeURIComponent(CARTO_KEY), {
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

  // -- RN/iframe -> map: only three message types, each fired once per
  // real change (a fresh chargers list, a real device-location update, a
  // tap-driven selection change) — never anything tied to the pan/zoom
  // gesture loop itself. This function only ever RECEIVES; nothing in
  // here posts back out, keeping the bridge one-directional per event.
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
  // react-native-webview delivers RN->WebView messages via a 'message'
  // event on document on iOS and on window on Android — a well-documented
  // platform difference, so both are listened on (harmless no-op on
  // whichever platform doesn't use it). The plain-iframe web host posts
  // via window.postMessage, which only ever arrives on window — covered
  // by the same window listener.
  document.addEventListener('message', onIncoming);
  window.addEventListener('message', onIncoming);

  // Diagnostics surface for automated verification (Playwright, run
  // against the web/.web.tsx host where the map's DOM is directly
  // reachable) — real, inspectable evidence rather than an assumption:
  // any3d reports whether Leaflet actually detected 3D-transform support
  // (and therefore uses translate3d/CSS3-transform panning, not the
  // legacy left/top positioning fallback); bridgeMessageCount is
  // incremented exactly once per post() call above, so a test can sample
  // it before/after a simulated drag and confirm it did not increase
  // mid-gesture.
  window.__kelo = {
    bridgeMessageCount: 0,
    getDiagnostics: function () {
      var pane = document.querySelector('.leaflet-map-pane');
      return {
        any3d: L.Browser.any3d,
        mapPaneTransform: pane ? pane.style.transform : null,
        bridgeMessageCount: window.__kelo.bridgeMessageCount,
        chargerMarkerCount: Object.keys(chargerMarkers).length,
      };
    },
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
