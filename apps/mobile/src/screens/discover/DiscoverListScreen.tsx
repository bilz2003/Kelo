import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Animated, Modal, ScrollView, ActivityIndicator, Linking, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from "react-native";
import { Search, SlidersHorizontal, MapPin, ChevronRight, TriangleAlert, X } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Chip, BrandMark } from "@/components/Controls";
import { PrimaryButton } from "@/components/Button";
import { DiscoverMap } from "@/components/DiscoverMap";
import { SheetHandle } from "@/components/SheetHandle";
import { useSlideSheet } from "@/components/useSlideSheet";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { searchLocation } from "@/api/chargers";
import { ApiError } from "@/api/client";
import { getForegroundLocation, shouldShowApproxDistanceNotice } from "@/lib/location";
import { DiscoverStackParamList } from "@/navigation/types";
import { Charger } from "@kelo/core";

type Props = NativeStackScreenProps<DiscoverStackParamList, "DiscoverList">;

const FILTERS = ["All", "Available now", "Tethered", "7kW+", "Fast 11kW+"];
const RADIUS_OPTIONS = [1, 3, 5, 10, 25];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ChargerCard({ charger, name, onPress }: { charger: Charger; name: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl,
        padding: 18, flexDirection: "row", justifyContent: "space-between", gap: 16, marginBottom: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 12, color: tokens.cyan }}>{charger.initials}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: tokens.text }}>{name}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, marginTop: 1 }}>{charger.postcode} · {charger.distance}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 16, color: tokens.text, marginBottom: 6 }}>{charger.title} — {charger.power}</Text>
        <Text style={{ fontSize: 12.5, color: tokens.textSoft }}>{charger.cable} · {charger.connector}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: fonts.mono, fontWeight: "500", fontSize: 22, color: tokens.text }}>£{charger.rate.toFixed(2)}</Text>
        <Text style={{ fontSize: 11, color: tokens.textSoft }}>per kWh</Text>
      </View>
    </Pressable>
  );
}

export function DiscoverListScreen({ navigation }: Props) {
  const { tokens, mode } = useTheme();
  const { chargers, chargersLoading, chargersError, refetchChargers, nameFor } = useChargerStore();
  const [filter, setFilter] = useState("All");
  const [radius, setRadius] = useState(5);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapPinSelected, setMapPinSelected] = useState<Charger | null>(null);
  const { translateY: sheetTranslateY, backdropOpacity, animateOut, springBack } = useSlideSheet(!!mapPinSelected);
  const closeSheet = () => animateOut(() => setMapPinSelected(null));

  // undefined = still resolving location (first mount only); null = no
  // real coords available (denied/error — backend falls back to its own
  // fixed reference point); otherwise the driver's real device location.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  const [approxNotice, setApproxNotice] = useState(false);
  const [locationDenialKind, setLocationDenialKind] = useState<"retry" | "settings" | null>(null);

  // Search bar — real now, not the styled placeholder it used to be (see
  // the input below). searchOrigin is null whenever there's no resolved
  // search override in effect; when set, it takes priority over coords as
  // the discover origin below, exactly like a temporary replacement for
  // "the driver's location" rather than a separate filter dimension.
  // Clearing the text (searchText === "") drops searchOrigin back to
  // null, which is *why* clearing genuinely reverts to the normal
  // device-location/fallback behavior rather than needing special-casing.
  const [searchText, setSearchText] = useState("");
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "error">("idle");
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);

  // Requested contextually here — the first time Discover/Map is actually
  // opened — not at cold app launch. Runs once; getForegroundLocation
  // itself only ever triggers the native OS prompt once too (see its own
  // doc comment), so this never re-nags on subsequent visits to this
  // screen (it never unmounts — it's pushed under Charger Detail, not
  // replaced).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const outcome = await getForegroundLocation();
        if (cancelled) return;
        if (outcome.status === "granted") {
          setCoords(outcome.coords);
          return;
        }
        // Denied or errored — fall back to the backend's fixed reference
        // point (send no coords at all) rather than blocking Discover.
        setCoords(null);
        if (outcome.status === "denied") {
          setLocationDenialKind(outcome.canAskAgain ? "retry" : "settings");
          if (await shouldShowApproxDistanceNotice()) {
            if (!cancelled) setApproxNotice(true);
          }
        }
      } catch {
        // Anything unexpected here (a storage read failing, some platform
        // quirk) must still fall back rather than leave coords stuck
        // `undefined` forever — that would leave the radius-effect below
        // waiting indefinitely and Discover never loading at all.
        if (!cancelled) setCoords(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced geocoding for the search bar — 450ms of no typing before it
  // actually hits the network, same idea as any other "don't fire a
  // request per keystroke" search box. Clearing the field (empty/
  // whitespace-only) drops back to device-location behavior immediately,
  // no debounce needed for that direction since there's no network call
  // to save by waiting.
  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setSearchOrigin(null);
      setSearchStatus("idle");
      setSearchErrorMessage(null);
      return;
    }
    setSearchStatus("searching");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await searchLocation(trimmed);
        if (cancelled) return;
        setSearchOrigin(result);
        setSearchStatus("idle");
        setSearchErrorMessage(null);
      } catch (err) {
        if (cancelled) return;
        // Unrecognized input (or a real network/server error) — graceful,
        // not a crash: keep showing whatever the last valid origin was
        // (searchOrigin only ever changes on a *successful* result above)
        // rather than blanking the list, and surface why underneath the
        // search bar.
        setSearchStatus("error");
        setSearchErrorMessage(err instanceof ApiError ? err.message : "Couldn't reach the search service — try again.");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText]);

  // Radius is server-side filtering (GET /chargers/discover?radiusMiles=),
  // not a client-side re-filter of an already-fetched list — so changing
  // the chip genuinely refetches against real distances, same as the
  // initial load. Waits for the location resolution above to settle
  // (coords !== undefined) before firing the very first fetch, so that
  // fetch is correctly-originated from the start rather than fetching
  // once against the fallback and again moments later against real
  // coords.
  //
  // useFocusEffect, not a plain useEffect — a real bug this refetch was
  // missing: this screen never unmounts (it's pushed under Charger
  // Detail, not replaced — see the location-permission comment above),
  // so a plain useEffect keyed on [radius, coords] only ever fires once,
  // on first mount, and again if radius/coords themselves change. It
  // never re-fires just from returning to this tab — so a charger added
  // (or edited, or removed) from My Chargers never showed up here until
  // the app was fully restarted. Same fix, same reasoning, as
  // MyChargersScreen's own refetchMyChargers/loadNextBooking and
  // BookingsScreen's own load — both already refetch on focus for
  // exactly this reason (state that changes elsewhere).
  //
  // searchOrigin, when set, wins over coords entirely — a resolved search
  // is a deliberate, explicit override of "where am I filtering from",
  // not an addition to it. Still gated on coords having resolved even
  // when a search is active, simply so the very first paint (before
  // location permission settles) doesn't fire a fetch against a search
  // typed in the same instant as a stale/undefined coords state — in
  // practice this only matters for a fraction of a second on cold mount.
  const effectiveOrigin = searchOrigin ?? coords ?? undefined;
  useFocusEffect(
    useCallback(() => {
      if (coords === undefined) return;
      refetchChargers(radius, effectiveOrigin);
    }, [radius, effectiveOrigin, coords, refetchChargers]),
  );

  const retryLocation = async () => {
    const outcome = await getForegroundLocation();
    if (outcome.status === "granted") {
      setLocationDenialKind(null);
      setApproxNotice(false);
      setCoords(outcome.coords);
    } else if (outcome.status === "denied") {
      setLocationDenialKind(outcome.canAskAgain ? "retry" : "settings");
    }
  };

  // The search bar + filter chips tuck away while scrolling down the list
  // (more room to browse) and reappear scrolling up or near the top —
  // same behavior as the web prototype's searchVisible state.
  const [searchVisible, setSearchVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const searchAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const onHeaderLayout = (e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height);
  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    if (y <= 8) setSearchVisible(true);
    else if (delta > 6) setSearchVisible(false);
    else if (delta < -6) setSearchVisible(true);
    lastScrollY.current = y;
  };
  React.useEffect(() => {
    Animated.timing(searchAnim, { toValue: searchVisible ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [searchVisible]);

  // Radius/sort are server-side (see the effect above); the filter chips
  // are a genuine client-side re-filter of that same already-fetched list —
  // real bug fix: these chips highlighted on tap but were never actually
  // applied to `visible` before, so every filter silently did nothing.
  const visible = chargers.filter((c) => {
    switch (filter) {
      case "Available now":
        return c.available;
      case "Tethered":
        return c.cable === "Tethered cable";
      case "7kW+":
        return c.powerNum >= 7;
      case "Fast 11kW+":
        return c.powerNum >= 11;
      default:
        return true;
    }
  });

  const goToDetail = (c: Charger) => {
    // Clear the map selection on navigate-away, not just on manual dismiss —
    // otherwise the sheet is still "open" underneath when the user comes
    // back from Charger Detail, since this screen never unmounts (it's just
    // pushed under the new one on the stack).
    setMapPinSelected(null);
    navigation.navigate("ChargerDetail", { charger: c });
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3 }}>Find a charger</Text>
          <BrandMark size={22} textSize={18} />
        </View>
        {/*
         * This used to hardcode "Carshalton, SM5" unconditionally — a
         * leftover from before real device location was wired in. It's
         * only actually true when coords is null (the backend's own
         * DEFAULT_SEARCH_ORIGIN fallback, which is that same Carshalton
         * centroid — see search-origin.ts), so it was silently lying
         * whenever a real GPS fix was in use. Now it reflects the same
         * three states the effect above resolves to, and — since there was
         * never anywhere for the chevron to navigate to — only keeps a
         * (functional) chevron in the fallback state, reusing the same
         * retry/settings action as the banner below.
         */}
        <Pressable
          onPress={coords === null ? () => (locationDenialKind === "settings" ? Linking.openSettings() : retryLocation()) : undefined}
          disabled={coords !== null}
          style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
        >
          <MapPin size={13} color={tokens.textSoft} />
          <Text style={{ color: tokens.textSoft, fontSize: 13 }}>
            {coords === undefined ? "Locating…" : coords === null ? "Carshalton, SM5 (approx.)" : "Your location"}
          </Text>
          {coords === null && <ChevronRight size={13} color={tokens.textSoft} />}
        </Pressable>
      </View>

      {approxNotice && (
        <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: "row", gap: 8, backgroundColor: "rgba(232,132,107,0.1)", borderWidth: 1, borderColor: "rgba(232,132,107,0.35)", borderRadius: radii.md, padding: 12 }}>
          <TriangleAlert size={14} color={tokens.danger} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: tokens.text, lineHeight: 17 }}>
              Distances shown are approximate — Kelo doesn't have your location.{" "}
              {locationDenialKind === "settings" ? "Enable it in Settings for accurate distances." : "You can allow it to see accurate distances."}
            </Text>
            <Pressable
              onPress={() => (locationDenialKind === "settings" ? Linking.openSettings() : retryLocation())}
              style={{ marginTop: 6 }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: tokens.cyan }}>
                {locationDenialKind === "settings" ? "Open Settings" : "Allow location"}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setApproxNotice(false)} hitSlop={8} style={{ padding: 2 }}>
            <X size={14} color={tokens.textSoft} />
          </Pressable>
        </View>
      )}

      <Animated.View
        style={{
          overflow: "hidden",
          maxHeight: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, headerHeight || 400] }),
          opacity: searchAnim,
        }}
      >
        <View onLayout={onHeaderLayout}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Search size={16} color={tokens.textSoft} />
              {/* Real now — this used to be styled placeholder Text with no
                  TextInput underneath it at all, which is why tapping it did
                  literally nothing (no overlay, no pointerEvents issue: there
                  was simply no focusable input here to receive the tap). */}
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search by postcode or area"
                placeholderTextColor={tokens.textSoft}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                style={{ flex: 1, fontSize: 13.5, color: tokens.text, padding: 0 }}
              />
              {searchStatus === "searching" && <ActivityIndicator size="small" color={tokens.textSoft} />}
              {searchText.length > 0 && searchStatus !== "searching" && (
                <Pressable onPress={() => setSearchText("")} hitSlop={8}>
                  <X size={15} color={tokens.textSoft} />
                </Pressable>
              )}
              <Pressable onPress={() => setFiltersOpen((o) => !o)} hitSlop={8}>
                <SlidersHorizontal size={15} color={filtersOpen ? tokens.cyan : tokens.textSoft} />
              </Pressable>
            </View>
            {searchStatus === "error" && searchErrorMessage && (
              <Text style={{ fontSize: 11.5, color: tokens.danger, marginTop: 8, lineHeight: 16 }}>{searchErrorMessage}</Text>
            )}
            {searchOrigin && searchStatus === "idle" && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.cyan, marginTop: 8 }}>
                Showing chargers near "{searchText.trim()}"
              </Text>
            )}
          </View>

          {filtersOpen && (
            <View style={{ marginBottom: 4 }}>
              <FlatList
                horizontal
                data={FILTERS}
                keyExtractor={(f) => f}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                renderItem={({ item }) => <Chip active={filter === item} onPress={() => setFilter(item)}>{item}</Chip>}
              />
              <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 12, marginBottom: 8, paddingHorizontal: 20 }}>
                Search radius
              </Text>
              <FlatList
                horizontal
                data={RADIUS_OPTIONS}
                keyExtractor={(r) => String(r)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}
                renderItem={({ item }) => <Chip active={radius === item} onPress={() => setRadius(item)}>Within {item} mi</Chip>}
              />
            </View>
          )}
        </View>
      </Animated.View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {chargersLoading ? "Loading…" : `${visible.length} chargers within ${radius} mi`}
        </Text>
        <View style={{ flexDirection: "row", gap: 3, backgroundColor: tokens.surface2, borderRadius: radii.sm, padding: 3 }}>
          {(["list", "map"] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setViewMode(key)}
              style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6, backgroundColor: viewMode === key ? tokens.cyan : "transparent" }}
            >
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: viewMode === key ? tokens.onAccent : tokens.textSoft }}>
                {key === "list" ? "List" : "Map"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flex: 1, position: "relative" }}>
        {chargersLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
            <ActivityIndicator color={tokens.cyan} />
          </View>
        ) : chargersError ? (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
              <TriangleAlert size={18} color={tokens.danger} style={{ marginBottom: 8 }} />
              <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center", marginBottom: 14 }}>{chargersError}</Text>
              <Pressable
                onPress={() => refetchChargers(radius)}
                style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 16 }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "500", color: tokens.text }}>Try again</Text>
              </Pressable>
            </View>
          </View>
        ) : visible.length === 0 && viewMode === "list" ? (
          // List view only — Map view's own empty state is the overlay
          // banner below, on top of the still-rendered map, not this full
          // replacement. There's no map to preserve here, so this stays
          // exactly as it was.
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
              <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center" }}>No chargers within {radius} mi. Try a wider radius.</Text>
            </View>
          </View>
        ) : viewMode === "list" ? (
          <FlatList
            data={visible}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => <ChargerCard charger={item} name={nameFor(item)} onPress={() => goToDetail(item)} />}
          />
        ) : null}

        {/* Always mounted, regardless of viewMode/loading/error/empty —
            visibility toggles via display, not conditional rendering, so
            the WebView instance (and the Leaflet page running inside it)
            never reloads just from switching tabs back and forth. Shown
            whenever view mode is "map" and there's no loading/error state
            to show instead — real bug fixed here: this used to also
            require visible.length > 0, so zero results in Map view hid
            the map entirely behind the text-only empty state above,
            instead of just showing zero pins on an otherwise-normal map. */}
        <View
          style={{
            position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
            display: viewMode === "map" && !chargersLoading && !chargersError ? "flex" : "none",
          }}
        >
          <DiscoverMap
            chargers={visible}
            selectedId={mapPinSelected?.id}
            onPinTap={(c) => setMapPinSelected(c)}
            onBackgroundTap={() => setMapPinSelected(null)}
            deviceLocation={coords}
            themeMode={mode}
          />
          {visible.length === 0 && (
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 16, right: 16, top: 16, alignItems: "center" }}
            >
              <View
                pointerEvents="auto"
                style={{
                  backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg,
                  paddingVertical: 10, paddingHorizontal: 16,
                  shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
                }}
              >
                <Text style={{ color: tokens.textSoft, fontSize: 12.5, textAlign: "center" }}>No chargers within {radius} mi. Try a wider radius.</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <Modal visible={!!mapPinSelected} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <AnimatedPressable
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(18,22,28,0.55)", opacity: backdropOpacity }}
            onPress={closeSheet}
          />
          <Animated.View
            style={{
              height: "55%", backgroundColor: tokens.ink, borderTopWidth: 1, borderTopColor: tokens.hair,
              borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, overflow: "hidden",
              transform: [{ translateY: sheetTranslateY }],
            }}
          >
            {/* Swallow taps so they don't fall through to the backdrop underneath. */}
            <Pressable onPress={() => {}}>
              {mapPinSelected && (
                <>
                  <SheetHandle onDismiss={closeSheet} onCancel={springBack} translateY={sheetTranslateY} />
                  <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 15, color: tokens.cyan }}>{mapPinSelected.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: tokens.text, marginBottom: 2 }}>{nameFor(mapPinSelected)}</Text>
                        <Text style={{ fontSize: 12.5, color: tokens.textSoft }}>{mapPinSelected.title} · {mapPinSelected.power} · {mapPinSelected.postcode}</Text>
                      </View>
                      <Pressable
                        onPress={() => goToDetail(mapPinSelected)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.cyanTint30, borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 10 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "500", color: tokens.cyan }}>Details</Text>
                        <ChevronRight size={15} color={tokens.cyan} />
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                      {([
                        ["Connector", mapPinSelected.connector],
                        ["Cable", mapPinSelected.cable.replace(" cable", "")],
                        ["Power", mapPinSelected.power],
                        ["Distance", mapPinSelected.distance],
                      ] as [string, string][]).map(([k, v]) => (
                        <View key={k} style={{ width: "47.5%", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 10 }}>
                          <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{k}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: tokens.text }}>{v}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Pricing</Text>
                    <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 14 }}>
                      {([
                        ["Charging rate", `£${mapPinSelected.rate.toFixed(2)} / kWh`],
                        ["Idle occupancy, after 15 min once full", `£${mapPinSelected.idleRate.toFixed(2)} / min`],
                        ["Overstay, after 15 min grace", `£${mapPinSelected.overstayRate.toFixed(2)} / min`],
                        ["Free cancellation", "up to 2 hrs before"],
                      ] as [string, string][]).map(([k, v], i, arr) => (
                        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: tokens.hair }}>
                          <Text style={{ fontSize: 12.5, color: tokens.textSoft }}>{k}</Text>
                          <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: tokens.text }}>{v}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={{ padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.hair }}>
                    <PrimaryButton onPress={() => goToDetail(mapPinSelected)}>View details</PrimaryButton>
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
