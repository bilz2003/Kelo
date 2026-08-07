import React, { useRef, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, Animated, Modal } from "react-native";
import { PinchGestureHandler, PinchGestureHandlerGestureEvent, State, PinchGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { Star, ShieldCheck, ImageOff, X, ChevronLeft, ChevronRight } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/Button";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { DiscoverStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<DiscoverStackParamList, "ChargerDetail">;

const REVIEWS = [
  { name: "Ravi", text: "Driveway was exactly as described, easy in and out. Cost matched the app to the penny.", stars: 5 },
  { name: "Emma", text: "James replied fast and the charger worked first time. Would book again.", stars: 5 },
];

/** Full-screen photo viewer — swipe between photos, pinch to zoom and spring back on release, matching the web prototype's Instagram-style peek. */
function PhotoViewer({ photos, index, onChangeIndex, onClose }: { photos: string[]; index: number; onChangeIndex: (i: number) => void; onClose: () => void }) {
  const { tokens } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: true });
  const onPinchStateChange = (e: PinchGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    }
  };

  const go = (delta: number) => onChangeIndex((index + delta + photos.length) % photos.length);

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: tokens.ink }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 54, paddingHorizontal: 20, paddingBottom: 8 }}>
          <Pressable onPress={onClose} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={tokens.text} />
          </Pressable>
          {photos.length > 1 && (
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft }}>{index + 1} / {photos.length}</Text>
          )}
          <View style={{ width: 34 }} />
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
          {photos.length > 1 && (
            <Pressable
              onPress={() => go(-1)}
              style={{ position: "absolute", left: 8, zIndex: 1, backgroundColor: "rgba(26,32,41,0.75)", borderWidth: 1, borderColor: tokens.hair, borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={16} color={tokens.text} />
            </Pressable>
          )}
          <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
            <Animated.Image
              source={{ uri: photos[index] }}
              resizeMode="contain"
              style={{ width: "100%", height: "100%", borderRadius: radii.xl, borderWidth: 1, borderColor: tokens.hair, transform: [{ scale }] }}
            />
          </PinchGestureHandler>
          {photos.length > 1 && (
            <Pressable
              onPress={() => go(1)}
              style={{ position: "absolute", right: 8, zIndex: 1, backgroundColor: "rgba(26,32,41,0.75)", borderWidth: 1, borderColor: tokens.hair, borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
            >
              <ChevronRight size={16} color={tokens.text} />
            </Pressable>
          )}
        </View>

        {photos.length > 1 && (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 20, paddingBottom: 34 }}>
            {photos.map((_, i) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? tokens.cyan : tokens.hair }} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

export function ChargerDetailScreen({ route, navigation }: Props) {
  const { tokens } = useTheme();
  const { chargers, nameFor } = useChargerStore();
  const routeCharger = route.params.charger;
  // Re-resolve from the store so any host-side edits made after this
  // screen was first opened are reflected immediately.
  const charger = chargers.find((c) => c.id === routeCharger.id) ?? routeCharger;
  const photos = charger.photos ?? [];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const infoRows: [string, string][] = [
    ["Connector", charger.connector],
    ["Cable", charger.cable.replace(" cable", "")],
    ["Power", charger.power],
    ["Distance", charger.distance],
  ];

  const pricingRows: [string, string][] = [
    ["Charging rate", `£${charger.rate.toFixed(2)} / kWh`],
    ["Idle occupancy, after 15 min once full", `£${charger.idleRate.toFixed(2)} / min`],
    ["Overstay, after 15 min grace", `£${charger.overstayRate.toFixed(2)} / min`],
    ["Free cancellation", "up to 2 hrs before"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <ScreenHeader title="Charger details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 16, color: tokens.cyan }}>{charger.initials}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: tokens.text }}>{nameFor(charger)}</Text>
            {charger.sessions > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                <Star size={12} color={tokens.cyan} fill={tokens.cyan} />
                <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: tokens.textSoft }}>
                  {charger.rating} · {charger.sessions} sessions · {charger.postcode}
                </Text>
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: tokens.textSoft, marginTop: 2 }}>New listing · {charger.postcode}</Text>
            )}
          </View>
        </View>

        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 22, color: tokens.text, marginBottom: 20, letterSpacing: -0.3 }}>
          {charger.title} — {charger.power}
        </Text>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Photos</Text>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 10 }}>
            {photos.map((uri, i) => (
              <Pressable key={i} onPress={() => setViewerIndex(i)}>
                <Image source={{ uri }} style={{ width: 210, height: 148, borderRadius: radii.lg, borderWidth: 1, borderColor: tokens.hair }} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 22, alignItems: "center", marginBottom: 20 }}>
            <ImageOff size={17} color={tokens.textSoft} style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: 12.5, color: tokens.textSoft }}>No photos added yet</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {infoRows.map(([k, v]) => (
            <View key={k} style={{ width: "47.5%", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 13 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{k}</Text>
              <Text style={{ fontSize: 14, fontWeight: "500", color: tokens.text }}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: tokens.surface, borderLeftWidth: 2, borderLeftColor: tokens.cyan, borderTopRightRadius: radii.lg, borderBottomRightRadius: radii.lg, padding: 14, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ShieldCheck size={16} color={tokens.cyan} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12.5, color: tokens.textSoft, lineHeight: 19 }}>
              Every kWh here is read directly from this charger's own meter — not estimated from battery %. You'll see the same timestamped reading the host sees.
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Pricing</Text>
        <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 16 }}>
          {pricingRows.map(([k, v], i) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: i < pricingRows.length - 1 ? 1 : 0, borderBottomColor: tokens.hair }}>
              <Text style={{ fontSize: 13, color: tokens.textSoft }}>{k}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Reviews</Text>
        {REVIEWS.map((r) => (
          <View key={r.name} style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: tokens.text }}>{r.name}</Text>
              <View style={{ flexDirection: "row", gap: 2 }}>
                {Array.from({ length: r.stars }).map((_, i) => (
                  <Star key={i} size={11} color={tokens.cyan} fill={tokens.cyan} />
                ))}
              </View>
            </View>
            <Text style={{ fontSize: 12.5, color: tokens.textSoft, lineHeight: 18 }}>{r.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: tokens.ink, borderTopWidth: 1, borderTopColor: tokens.hair, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 19, fontWeight: "500", color: tokens.text }}>£{charger.rate.toFixed(2)}</Text>
          <Text style={{ fontSize: 10.5, color: tokens.textSoft }}>per kWh</Text>
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton onPress={() => navigation.navigate("BookingFlow", { charger })}>Book this charger</PrimaryButton>
        </View>
      </View>

      {viewerIndex !== null && (
        <PhotoViewer photos={photos} index={viewerIndex} onChangeIndex={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  );
}
