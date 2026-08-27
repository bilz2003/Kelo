import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Clock, TriangleAlert } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { GhostButton, PrimaryButton } from "@/components/Button";
import { TimeFilterButton } from "@/components/TimeFilterButton";
import { getMyBookings, cancelBooking, BookingDetail } from "@/api/bookings";
import { ApiError } from "@/api/client";
import { TimeRangeValue, defaultTimeRange, dateLabel, formatTimeOfDay, formatTimeWithDay, FREE_CANCELLATION_WINDOW_HOURS } from "@kelo/core";

const STATUS_LABEL: Record<BookingDetail["status"], string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Charging",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

const statusColor = (tokens: ReturnType<typeof useTheme>["tokens"], s: BookingDetail["status"]) =>
  s === "UPCOMING" || s === "ACTIVE" ? tokens.cyan : s === "CANCELLED" || s === "NO_SHOW" ? tokens.danger : tokens.textSoft;

function BookingCard({ booking, onCancelled }: { booking: BookingDetail; onCancelled: () => void }) {
  const { tokens } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arrival = new Date(booking.arrivalAt);
  const end = new Date(booking.endAt);
  const hoursUntilArrival = (arrival.getTime() - Date.now()) / 3_600_000;
  const willBeFree = hoursUntilArrival > FREE_CANCELLATION_WINDOW_HOURS;
  const canCancel = booking.status === "UPCOMING";

  const confirmCancel = async () => {
    setError(null);
    setCancelling(true);
    try {
      await cancelBooking(booking.id);
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel this booking — try again.");
      setCancelling(false);
    }
  };

  return (
    <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 15, color: tokens.text }}>{booking.charger.title}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: statusColor(tokens, booking.status), textTransform: "uppercase" }}>
          {STATUS_LABEL[booking.status]}
        </Text>
      </View>
      <Text style={{ fontSize: 12.5, color: tokens.textSoft, marginBottom: 10 }}>{booking.charger.owner.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: canCancel ? 12 : 0 }}>
        <Clock size={12} color={tokens.textSoft} />
        <Text style={{ fontSize: 12, color: tokens.textSoft }}>
          {dateLabel(arrival)} · {formatTimeOfDay(arrival)} – {formatTimeWithDay(end, arrival)}
        </Text>
      </View>

      {canCancel && !confirming && (
        <Pressable onPress={() => setConfirming(true)}>
          <Text style={{ fontSize: 12.5, fontWeight: "500", color: tokens.danger }}>Cancel booking</Text>
        </Pressable>
      )}

      {canCancel && confirming && (
        <View style={{ marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.hair }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TriangleAlert size={14} color={willBeFree ? tokens.textSoft : tokens.danger} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12.5, color: tokens.text, lineHeight: 18 }}>
              {willBeFree
                ? "This booking is more than 2 hours away — cancelling now is free."
                : `Less than 2 hours until arrival — cancelling now charges the host's no-show fee of £${booking.charger.noShowFee.toFixed(2)}.`}
            </Text>
          </View>
          {error && <Text style={{ fontSize: 11.5, color: tokens.danger, marginBottom: 10 }}>{error}</Text>}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <GhostButton onPress={() => setConfirming(false)}>Keep booking</GhostButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton onPress={confirmCancel} disabled={cancelling} style={{ backgroundColor: willBeFree ? undefined : tokens.danger }}>
                {cancelling ? <ActivityIndicator color={tokens.onAccent} /> : willBeFree ? "Cancel — free" : `Cancel — £${booking.charger.noShowFee.toFixed(2)} fee`}
              </PrimaryButton>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export function BookingsScreen() {
  const { tokens } = useTheme();
  const [range, setRange] = useState<TimeRangeValue>(defaultTimeRange());
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your bookings — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Real data, refetched every time this tab regains focus — a booking
  // cancelled or completed elsewhere (or just now, on this same screen)
  // needs to show its current real status, not a stale one from whenever
  // this screen last mounted.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = bookings.filter((b) => {
    const arrival = new Date(b.arrivalAt);
    return arrival >= range.start && arrival <= range.end;
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3, marginBottom: 14 }}>Bookings</Text>
        <TimeFilterButton value={range} onChange={setRange} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
          <ActivityIndicator color={tokens.cyan} />
        </View>
      ) : loadError ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
            <TriangleAlert size={18} color={tokens.danger} style={{ marginBottom: 8 }} />
            <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center", marginBottom: 14 }}>{loadError}</Text>
            <Pressable
              onPress={load}
              style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: tokens.text }}>Try again</Text>
            </Pressable>
          </View>
        </View>
      ) : (
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
          renderItem={({ item }) => <BookingCard booking={item} onCancelled={load} />}
        />
      )}
    </View>
  );
}
