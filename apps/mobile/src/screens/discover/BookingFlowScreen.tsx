import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Clock, Lock } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/Button";
import { TimeSlotPicker, ArrivalDatePicker } from "@/components/TimePickers";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { DiscoverStackParamList } from "@/navigation/types";
import { NOW, nextFullHour, startOfDay, dayEndOf, isSameDate, formatTimeOfDay, formatTimeWithDay, formatDuration, dateLabel } from "@kelo/core";
import { MIN_BOOKING_HOURS, MAX_BOOKING_HOURS } from "@kelo/core";
import { estimateBookingEnergy } from "@kelo/core";

type Props = NativeStackScreenProps<DiscoverStackParamList, "BookingFlow">;

export function BookingFlowScreen({ route, navigation }: Props) {
  const { tokens } = useTheme();
  const { nameFor } = useChargerStore();
  const charger = route.params.charger;

  const [arrival, setArrival] = useState(nextFullHour(NOW));
  const [endTime, setEndTime] = useState(new Date(nextFullHour(NOW).getTime() + MIN_BOOKING_HOURS * 3600000));

  const isToday = isSameDate(arrival, NOW);
  const earliestArrivalTime = isToday ? nextFullHour(NOW) : startOfDay(arrival);
  const latestArrivalTime = dayEndOf(arrival);
  const minEndTime = new Date(arrival.getTime() + MIN_BOOKING_HOURS * 3600000);
  const maxEndTime = new Date(arrival.getTime() + MAX_BOOKING_HOURS * 3600000);

  const handleArrivalTimeChange = (t: Date) => {
    setArrival(t);
    const newMinEnd = new Date(t.getTime() + MIN_BOOKING_HOURS * 3600000);
    setEndTime((prev) => (prev < newMinEnd ? newMinEnd : prev));
  };

  const handleDateChange = (newDate: Date) => {
    const combined = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), arrival.getHours(), arrival.getMinutes());
    const isNewToday = isSameDate(newDate, NOW);
    const earliestForNewDay = isNewToday ? nextFullHour(NOW) : startOfDay(newDate);
    const finalArrival = combined < earliestForNewDay ? earliestForNewDay : combined;
    setArrival(finalArrival);
    const newMinEnd = new Date(finalArrival.getTime() + MIN_BOOKING_HOURS * 3600000);
    setEndTime((prev) => (prev < newMinEnd ? newMinEnd : prev));
  };

  const durationHours = (endTime.getTime() - arrival.getTime()) / 3600000;
  const { estKwh, estCost } = estimateBookingEnergy(charger, durationHours);

  const rows: [string, string][] = [
    ["Est. energy delivered", `~${estKwh} kWh`],
    ["Est. charging cost", `£${estCost}`],
    ["Service charge", "£1.49"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <ScreenHeader title="Book charger" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontSize: 13, color: tokens.textSoft, marginBottom: 20 }}>
          {charger.title} — {nameFor(charger)}, {charger.postcode}
        </Text>

        <ArrivalDatePicker value={arrival} onChange={handleDateChange} />
        <TimeSlotPicker label="Arrival time" value={arrival} onChange={handleArrivalTimeChange} min={earliestArrivalTime} max={latestArrivalTime} anchor={NOW} />
        <TimeSlotPicker label="Done by" value={endTime} onChange={setEndTime} min={minEndTime} max={maxEndTime} anchor={arrival} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.cyanTint10, borderRadius: radii.md, padding: 12, marginBottom: 22 }}>
          <Clock size={13} color={tokens.cyan} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: tokens.cyan }}>
            {dateLabel(arrival)} · {formatTimeOfDay(arrival)} – {formatTimeWithDay(endTime, arrival)} · {formatDuration(durationHours)} booked
          </Text>
        </View>

        <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17, marginBottom: 24 }}>
          This books the driveway from arrival until your chosen end time — even if your car finishes charging early, the space stays reserved until then. Minimum booking length is 1 hour.
        </Text>

        <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 16, marginBottom: 16 }}>
          {rows.map(([k, v], i) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: tokens.hair }}>
              <Text style={{ fontSize: 13, color: tokens.textSoft }}>{k}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Lock size={13} color={tokens.textSoft} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
            £1.49 is charged now. Your actual charging cost is settled after the session, from the charger's own verified meter reading — never an estimate. Free cancellation up to 2 hours before arrival.
          </Text>
        </View>
      </ScrollView>

      <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair, backgroundColor: tokens.ink }}>
        <PrimaryButton
          onPress={() =>
            navigation.navigate("BookingConfirmed", {
              charger,
              details: { arrival, endTime, durationHours, estKwh, estCost },
            })
          }
        >
          Confirm booking
        </PrimaryButton>
      </View>
    </View>
  );
}
