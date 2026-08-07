import React, { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Plus, Pencil, ChevronRight, Car } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Toggle, PulseDot } from "@/components/Controls";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { useSession } from "@/state/SessionContext";
import { computeSessionFinancials } from "@/utils/pricing";
import { Charger } from "@/types";

function MyChargerCard({
  charger, name, available, onToggleAvailable, isCharging, liveKwh, liveSeconds,
}: {
  charger: Charger; name: string; available: boolean; onToggleAvailable: () => void;
  isCharging: boolean; liveKwh: number; liveSeconds: number;
}) {
  const { tokens } = useTheme();
  const live = isCharging ? computeSessionFinancials(charger, liveKwh, liveSeconds) : null;

  return (
    <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: isCharging ? tokens.cyanTint30 : tokens.hair, borderRadius: radii.xl, padding: 18, marginBottom: 16 }}>
      <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 16, color: tokens.text, marginBottom: 4 }}>{name}</Text>
      <Text style={{ fontSize: 12, color: tokens.textSoft, marginBottom: 14 }}>
        {charger.title} · {charger.power} · £{charger.rate.toFixed(2)}/kWh · {charger.postcode}
      </Text>

      {isCharging && live ? (
        <View style={{ paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.hair }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <PulseDot />
            <Text style={{ fontSize: 13.5, fontWeight: "500", color: tokens.cyan }}>Charging now</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: tokens.text }}>{liveKwh.toFixed(3)}</Text>
              <Text style={{ fontSize: 9.5, color: tokens.textSoft }}>kWh so far</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: live.idleChargesActive ? tokens.danger : tokens.hair, borderRadius: radii.md, padding: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: tokens.text }}>£{live.hostNet.toFixed(2)}</Text>
              <Text style={{ fontSize: 9.5, color: tokens.textSoft }}>{live.idleChargesActive ? "earning so far, incl. idle" : "earning so far"}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.hair }}>
          <Text style={{ fontSize: 13.5, color: tokens.text }}>Available for booking</Text>
          <Toggle on={available} onToggle={onToggleAvailable} />
        </View>
      )}

      <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14 }}>
        <Pencil size={14} color={tokens.textSoft} />
        <Text style={{ flex: 1, fontSize: 13.5, color: tokens.text }}>Edit charger details</Text>
        <ChevronRight size={15} color={tokens.textSoft} />
      </Pressable>
    </View>
  );
}

export function MyChargersScreen() {
  const { tokens } = useTheme();
  const { myChargers, nameFor } = useChargerStore();
  const session = useSession();
  const [availability, setAvailability] = useState<Record<number, boolean>>({});
  const [myCarOverride, setMyCarOverride] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3 }}>My chargers</Text>
        <Pressable style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.cyan, alignItems: "center", justifyContent: "center" }}>
          <Plus size={17} color={tokens.onAccent} />
        </Pressable>
      </View>

      <FlatList
        data={myChargers}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            This month, across all chargers
          </Text>
        }
        renderItem={({ item }) => (
          <MyChargerCard
            charger={item}
            name={nameFor(item)}
            available={availability[item.id] ?? true}
            onToggleAvailable={() => setAvailability((prev) => ({ ...prev, [item.id]: !(prev[item.id] ?? true) }))}
            isCharging={session.active && session.charger?.id === item.id}
            liveKwh={session.kwh}
            liveSeconds={session.seconds}
          />
        )}
        ListFooterComponent={
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Car size={15} color={tokens.textSoft} />
                <Text style={{ fontSize: 13.5, fontWeight: "500", color: tokens.text }}>This is actually my car</Text>
              </View>
              <Toggle on={myCarOverride} onToggle={() => setMyCarOverride((v) => !v)} />
            </View>
            <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
              Only shows during a confirmed booking window. Switch this on to charge your own car without a driver payment hold — it's logged for any later dispute.
            </Text>
          </View>
        }
      />

      {/*
        Follow-up: port the full Add/Edit charger flow (model picker,
        photo upload via expo-image-picker, pricing fields, remove-charger
        confirmation) — kept out of this pass to focus on the core loop.
      */}
    </View>
  );
}
