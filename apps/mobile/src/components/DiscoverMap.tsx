import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { Charger } from "@kelo/core";
import { buildMapHtml } from "./discoverMapHtml";

const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "";

interface DiscoverMapProps {
  chargers: Charger[];
  selectedId: number | undefined;
  onPinTap: (c: Charger) => void;
  onBackgroundTap: () => void;
  // Real device location from the Discover location-permission flow
  // (DiscoverListScreen's own getForegroundLocation) — undefined/null
  // means no real fix (denied, or still resolving): no "You" marker is
  // drawn in that case, rather than a fabricated position.
  deviceLocation?: { lat: number; lng: number } | null;
  // The app's current theme (@/theme/ThemeContext) — baked in as the
  // WebView's initial tile source (no flash of the wrong theme on first
  // paint) and pushed live via postMessage on every change after that, so
  // toggling Account > Appearance while the map is already open updates
  // it in place rather than only on the next time it's opened.
  themeMode: "light" | "dark";
}

/**
 * Real, geographically accurate map — a Leaflet map running inside a
 * WebView, replacing the old stylized postcode-lookup grid entirely. See
 * discoverMapHtml.ts for the actual map/tile/marker implementation shared
 * with the web platform variant, and MAP-INTEGRATION.md for the full
 * picture (tile provider decision, verified smoothness optimizations,
 * what's proven vs a human judgment call).
 */
export function DiscoverMap({ chargers, selectedId, onPinTap, onBackgroundTap, deviceLocation, themeMode }: DiscoverMapProps) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Built once per mount — the HTML document itself never changes after
  // that. Real data (chargers, device location, selection, theme after
  // the first paint) is pushed in afterward via postMessage instead of
  // regenerating/reloading this string, which is what makes it possible
  // for the WebView instance (kept mounted across viewMode/tab changes by
  // DiscoverListScreen) to genuinely stay warm rather than reloading the
  // Leaflet bundle every time the map becomes visible again. themeMode is
  // read once here deliberately (initial paint only) — see the effect
  // below for the live-update path.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml(CARTO_API_KEY, themeMode), []);

  const chargerPayload = () =>
    chargers.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));

  // Real finding, checked against react-native-webview 13.16.1's own
  // native source (apple/RNCWebViewImpl.m, android/.../
  // RNCWebViewManagerImpl.kt), not assumed: .postMessage() and
  // .injectJavaScript() are THE SAME underlying native call in this
  // library — postMessage's iOS implementation is literally
  // `[self injectJavaScript: "window.dispatchEvent(new MessageEvent(...))"]`,
  // and its Android implementation is the same
  // `webView.evaluateJavascriptWithFallback(...)` injectJavaScript
  // itself calls. So switching this to injectJavaScript would not
  // change delivery reliability at all — it would just skip building the
  // MessageEvent wrapper, calling the page's logic directly instead (see
  // window.__kelo.applyMessage below). Real value, but not a fix for
  // "does this reach the page" — see the focus-resync effect below for
  // the part of this that's an actual fix.
  const post = (message: Record<string, unknown>) => {
    const json = JSON.stringify(message);
    webViewRef.current?.injectJavaScript(
      `window.__kelo && window.__kelo.applyMessage && window.__kelo.applyMessage(${json}); true;`,
    );
  };

  // Each of these fires only when the underlying value actually changes
  // (a real refetch, a real location update, a real tap-driven
  // selection) — never inside a gesture handler, and never on every
  // render regardless of whether anything changed.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: "setChargers", chargers: chargerPayload() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargers]);

  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: "setDeviceLocation", lat: deviceLocation?.lat ?? null, lng: deviceLocation?.lng ?? null });
  }, [deviceLocation?.lat, deviceLocation?.lng]);

  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: "setSelected", chargerId: selectedId ?? null });
  }, [selectedId]);

  // Live theme switch — pushed the moment the prop changes, wherever the
  // app currently is (this fires from a Context update, not from
  // anything tab/focus-related — confirmed live on web: toggling from
  // the Account tab fires the real tile request immediately, before ever
  // switching back to Discover). Kept as belt-and-suspenders alongside
  // the focus-resync effect below, not replaced by it — that effect only
  // guarantees eventual correctness *on return* to this screen; this one
  // is what makes the switch visible in real time if the map happens to
  // already be the screen on top when it's toggled.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: "setTheme", mode: themeMode });
  }, [themeMode]);

  // Real fix, not a cosmetic one: this project found no way to prove
  // from code alone that a live-while-hidden postMessage/injectJavaScript
  // call reliably reaches a WebView sitting on a currently-inactive tab
  // on a real device — react-native-webview's own source confirms
  // postMessage and injectJavaScript are literally the same native call,
  // so switching between them (done above) cannot be the actual fix for
  // that class of gap if it exists. What genuinely closes it regardless
  // of the underlying platform reason: re-push the full current state
  // every time this screen regains focus, exactly like
  // DiscoverListScreen's own useFocusEffect refetch (added for the same
  // "state that can go stale while this screen isn't the one on top"
  // reasoning). Even if every single live-while-hidden push were
  // silently dropped, the map would still be correct the moment it's
  // actually looked at again.
  useFocusEffect(
    useCallback(() => {
      if (!readyRef.current) return;
      post({ type: "setChargers", chargers: chargerPayload() });
      post({ type: "setDeviceLocation", lat: deviceLocation?.lat ?? null, lng: deviceLocation?.lng ?? null });
      post({ type: "setSelected", chargerId: selectedId ?? null });
      post({ type: "setTheme", mode: themeMode });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [themeMode, selectedId, deviceLocation?.lat, deviceLocation?.lng, chargers]),
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: { type: string; chargerId?: number };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") {
      readyRef.current = true;
      post({ type: "setChargers", chargers: chargerPayload() });
      post({ type: "setDeviceLocation", lat: deviceLocation?.lat ?? null, lng: deviceLocation?.lng ?? null });
      post({ type: "setSelected", chargerId: selectedId ?? null });
      // Real gap this fixes: 'ready' can legitimately fire more than
      // once — not just on first load. buildMapHtml bakes the *initial*
      // theme into the page's own HTML string, so if the page ever
      // reinitializes after that first paint for any reason, it reloads
      // with whatever theme was active at the very first mount, not the
      // current one — and until this fix, this resync burst never
      // included theme at all, so a reinitialize would silently strand
      // the map on a stale theme forever, immune to this same handshake
      // correcting it. Including it here means every 'ready' — first or
      // Nth — re-establishes the actually-current theme.
      post({ type: "setTheme", mode: themeMode });
      if (deviceLocation) {
        post({ type: "setCenter", lat: deviceLocation.lat, lng: deviceLocation.lng });
      }
    } else if (msg.type === "pinTap") {
      const charger = chargers.find((c) => c.id === msg.chargerId);
      if (charger) onPinTap(charger);
    } else if (msg.type === "backgroundTap") {
      onBackgroundTap();
    }
  };

  const bg = themeMode === "light" ? "#E5E7EB" : "#12161C";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={handleMessage}
        // Leaflet owns 100% of gesture handling — the WebView's own
        // native scroll/bounce/overscroll is fully disabled so there is
        // no dual-handling conflict between the native scroll view and
        // Leaflet's own JS-driven pan/zoom (see discoverMapHtml.ts's
        // viewport meta + touch-action:none for the page-level half of
        // this same requirement).
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled={false}
        // iOS: react-native-webview ships WKWebView as its only iOS
        // backend — confirmed against the installed package's own
        // source (no UIWebView reference anywhere in it), not assumed.
        // Android: androidLayerType explicitly forces hardware-
        // accelerated compositing for this view. Confirmed against
        // RNCWebViewManagerImpl.kt that leaving this unset resolves to
        // LAYER_TYPE_NONE, not LAYER_TYPE_HARDWARE — setting it
        // explicitly is a real, meaningful change, not restating a
        // default.
        androidLayerType="hardware"
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: bg }}
      />
    </View>
  );
}
