import React, { useState } from "react";
import { View, Text, FlatList } from "react-native";
import { Clock } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { TimeFilterButton } from "@/components/TimeFilterButton";
import { BOOKINGS } from "@/data/mockBookings";
import { Booking, TimeRangeValue } from "@kelo/core";
import { defaultTimeRange } from "@kelo/core";

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const statusColor = (tokens: ReturnType<typeof useTheme>["tokens"], s: Booking["status"]) =>
  s === "Upcoming" ? tokens.cyan : s === "Cancelled" || s === "No show" ? tokens.danger : tokens.textSoft;

export function BookingsScreen() {
  const { tokens } = useTheme();
  const [range, setRange] = useState<TimeRangeValue>(defaultTimeRange());

  const visible = BOOKINGS.filter((b) => {
    const d = parseISODate(b.dateISO);
    return d >= range.start && d <= range.end;
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3, marginBottom: 14 }}>Bookings</Text>
        <TimeFilterButton value={range} onChange={setRange} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            {visible.length} bookings · {range.label}
          </Text>
        }
        ListEmptyComponent={
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
            <Text style={{ color: tokens.textSoft, fontSize: 13 }}>No bookings in this period.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 15, color: tokens.text }}>{item.title}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: statusColor(tokens, item.status), textTransform: "uppercase" }}>{item.status}</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: tokens.textSoft, marginBottom: 10 }}>{item.host}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock size={12} color={tokens.textSoft} />
                <Text style={{ fontSize: 12, color: tokens.textSoft }}>{item.date}</Text>
              </View>
              {item.cost && <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{item.cost}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}
