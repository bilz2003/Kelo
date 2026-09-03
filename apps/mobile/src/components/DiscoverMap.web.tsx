import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { Charger } from "@kelo/core";
import { buildMapHtml } from "./discoverMapHtml";

const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "";

interface DiscoverMapProps {
  chargers: Charger[];
  selectedId: number | undefined;
  onPinTap: (c: Charger) => void;
  onBackgroundTap: () => void;
  deviceLocation?: { lat: number; lng: number } | null;
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
export function DiscoverMap({ chargers, selectedId, onPinTap, onBackgroundTap, deviceLocation }: DiscoverMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const html = useMemo(() => buildMapHtml(CARTO_API_KEY), []);

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
  }, [chargers, selectedId, deviceLocation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#12161C" }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Discover map"
        style={{ flex: 1, border: "none", width: "100%", height: "100%", backgroundColor: "#12161C" } as React.CSSProperties}
      />
    </View>
  );
}
