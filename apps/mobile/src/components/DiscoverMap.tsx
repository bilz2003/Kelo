import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
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
}

/**
 * Real, geographically accurate map — a Leaflet map running inside a
 * WebView, replacing the old stylized postcode-lookup grid entirely. See
 * discoverMapHtml.ts for the actual map/tile/marker implementation shared
 * with the web platform variant, and MAP-INTEGRATION.md for the full
 * picture (tile provider decision, verified smoothness optimizations,
 * what's proven vs a human judgment call).
 */
export function DiscoverMap({ chargers, selectedId, onPinTap, onBackgroundTap, deviceLocation }: DiscoverMapProps) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Built once per mount — the HTML document itself never changes after
  // that. Real data (chargers, device location, selection) is pushed in
  // afterward via postMessage instead of regenerating/reloading this
  // string, which is what makes it possible for the WebView instance
  // (kept mounted across viewMode/tab changes by DiscoverListScreen) to
  // genuinely stay warm rather than reloading the Leaflet bundle every
  // time the map becomes visible again.
  const html = useMemo(() => buildMapHtml(CARTO_API_KEY), []);

  const chargerPayload = () =>
    chargers.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));

  const post = (message: Record<string, unknown>) => {
    webViewRef.current?.postMessage(JSON.stringify(message));
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

  return (
    <View style={{ flex: 1, backgroundColor: "#12161C" }}>
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
        style={{ flex: 1, backgroundColor: "#12161C" }}
      />
    </View>
  );
}
