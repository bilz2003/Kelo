import React, { useState } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { Search, SlidersHorizontal, MapPin, ChevronRight } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Chip, BrandMark } from "@/components/Controls";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { DiscoverStackParamList } from "@/navigation/types";
import { Charger } from "@/types";

type Props = NativeStackScreenProps<DiscoverStackParamList, "DiscoverList">;

const FILTERS = ["All", "Available now", "Tethered", "7kW+", "Fast 11kW+"];
const RADIUS_OPTIONS = [1, 3, 5, 10, 25];

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

  const visible = chargers.filter((c) => parseFloat(c.distance) <= radius);

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

      <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Search size={16} color={tokens.textSoft} />
          <TextInput placeholder="Search by postcode or area" placeholderTextColor={tokens.textSoft} style={{ flex: 1, color: tokens.text, fontSize: 13.5 }} />
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

      <FlatList
        data={visible}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            {visible.length} chargers within {radius} mi
          </Text>
        }
        ListEmptyComponent={
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
            <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center" }}>No chargers within {radius} mi. Try a wider radius.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChargerCard charger={item} name={nameFor(item)} onPress={() => navigation.navigate("ChargerDetail", { charger: item })} />
        )}
      />

      {/*
        Follow-up: the web prototype also has a draggable Map view with
        pin clustering and a pricing bottom sheet. Porting that natively
        needs `react-native-maps` (or Mapbox) plus real geocoding — worth
        scoping as its own task rather than faking it here.
      */}
    </View>
  );
}
