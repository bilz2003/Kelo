import React, { useRef, useState } from "react";
import { View, Text, FlatList, Pressable, Animated, Modal, ScrollView, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from "react-native";
import { Search, SlidersHorizontal, MapPin, ChevronRight } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Chip, BrandMark } from "@/components/Controls";
import { PrimaryButton } from "@/components/Button";
import { DiscoverMap } from "@/components/DiscoverMap";
import { SheetHandle } from "@/components/SheetHandle";
import { useSlideSheet } from "@/components/useSlideSheet";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { DiscoverStackParamList } from "@/navigation/types";
import { Charger } from "@/types";

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
  const { tokens } = useTheme();
  const { chargers, nameFor } = useChargerStore();
  const [filter, setFilter] = useState("All");
  const [radius, setRadius] = useState(5);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [mapPinSelected, setMapPinSelected] = useState<Charger | null>(null);
  const { translateY: sheetTranslateY, backdropOpacity, animateOut, springBack } = useSlideSheet(!!mapPinSelected);
  const closeSheet = () => animateOut(() => setMapPinSelected(null));

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

  const visible = chargers.filter((c) => parseFloat(c.distance) <= radius);

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <MapPin size={13} color={tokens.textSoft} />
          <Text style={{ color: tokens.textSoft, fontSize: 13 }}>Carshalton, SM5</Text>
          <ChevronRight size={13} color={tokens.textSoft} />
        </View>
      </View>

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
              {/* Matches the web prototype: this is styled placeholder text, not a working
                  search field yet — search isn't wired up to anything there either. */}
              <Text style={{ flex: 1, fontSize: 13.5, color: tokens.textSoft }}>Search by postcode or area</Text>
              <Pressable onPress={() => setFiltersOpen((o) => !o)}>
                <SlidersHorizontal size={15} color={filtersOpen ? tokens.cyan : tokens.textSoft} />
              </Pressable>
            </View>
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
          {visible.length} chargers within {radius} mi
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

      {visible.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
            <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center" }}>No chargers within {radius} mi. Try a wider radius.</Text>
          </View>
        </View>
      ) : viewMode === "map" ? (
        <View style={{ flex: 1 }}>
          <DiscoverMap
            chargers={visible}
            selectedId={mapPinSelected?.id}
            onPinTap={(c) => setMapPinSelected(c)}
            onBackgroundTap={() => setMapPinSelected(null)}
          />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <ChargerCard charger={item} name={nameFor(item)} onPress={() => goToDetail(item)} />}
        />
      )}

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
