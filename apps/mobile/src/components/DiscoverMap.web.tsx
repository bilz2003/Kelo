import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Charger } from "@kelo/core";
import { buildMapHtml } from "./discoverMapHtml";

const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "";

interface DiscoverMapProps {
  chargers: Charger[];
  selectedId: number | undefined;
  onPinTap: (c: Charger) => void;
  onBackgroundTap: () => void;
  deviceLocation?: { lat: number; lng: number } | null;
  // See DiscoverMap.tsx for the full explanation — same contract here.
  themeMode: "light" | "dark";
}

/**
 * Web counterpart to DiscoverMap.tsx — react-native-webview has no web
 * implementation at all (confirmed against its own package contents, no
 * .web.* files present), so this is the platform-extension override
 * Metro picks up automatically for the web target, exactly the same
 * mechanism apps/mobile/src/lib/secureStorage.web.ts already established
 * in this codebase. Hosts the identical HTML from discoverMapHtml.ts in a
 * plain <iframe> — the direct web equivalent of a native WebView — using
 * postMessage/message-event the same way, just addressed to/from
 * `iframe.contentWindow` instead of react-native-webview's `ref.postMessage`/
 * `onMessage`. This is what makes the project's existing web-preview +
 * Playwright pipeline (see TESTING.md) able to exercise the real map
 * content for real, not a stand-in for it.
 */
export function DiscoverMap({ chargers, selectedId, onPinTap, onBackgroundTap, deviceLocation, themeMode }: DiscoverMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // themeMode read once here (initial paint) — see the effect below for
  // the live-update path, matching DiscoverMap.tsx exactly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildMapHtml(CARTO_API_KEY, themeMode), []);

  const chargerPayload = () =>
    chargers.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));

  const post = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), "*");
  };

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

  // Live theme switch — same reasoning as DiscoverMap.tsx: the iframe
  // never reloads, so this is the only path a toggle made while the map
  // is already open can reach it.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: "setTheme", mode: themeMode });
  }, [themeMode]);

  // Same focus-resync fix as DiscoverMap.tsx — see its own comment for
  // the full reasoning. Kept here too for symmetry even though the
  // iframe transport doesn't share native's specific "is the WebView on
  // a currently-inactive tab" question; costs nothing and closes the
  // same class of gap if it turns out to exist here too.
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let msg: { type: string; chargerId?: number };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "ready") {
        readyRef.current = true;
        post({ type: "setChargers", chargers: chargerPayload() });
        post({ type: "setDeviceLocation", lat: deviceLocation?.lat ?? null, lng: deviceLocation?.lng ?? null });
        post({ type: "setSelected", chargerId: selectedId ?? null });
        // See DiscoverMap.tsx's 'ready' handler for why this belongs in
        // every resync burst, not just the live-toggle effect above.
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
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargers, selectedId, deviceLocation, themeMode]);

  const bg = themeMode === "light" ? "#E5E7EB" : "#12161C";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Discover map"
        style={{ flex: 1, border: "none", width: "100%", height: "100%", backgroundColor: bg } as React.CSSProperties}
      />
    </View>
  );
}
