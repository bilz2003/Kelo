import React, { useEffect, useState } from "react";
import { View, Text, Linking, Pressable, ActivityIndicator } from "react-native";
import { Check, MapPin } from "lucide-react-native";
import { NativeStackScreenProps, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { PrimaryButton, GhostButton } from "@/components/Button";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { useSession } from "@/state/SessionContext";
import { DiscoverStackParamList, RootStackParamList } from "@/navigation/types";
import { dateLabel, formatTimeOfDay, formatTimeWithDay } from "@kelo/core";
import { getBookingDetail } from "@/api/bookings";
import { ApiError } from "@/api/client";

type Props = NativeStackScreenProps<DiscoverStackParamList, "BookingConfirmed">;

export function BookingConfirmedScreen({ route, navigation }: Props) {
  const { tokens } = useTheme();
  const { nameFor } = useChargerStore();
  const session = useSession();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const { charger, details, bookingId } = route.params;

  // charger came through navigation params from Discover, which never
  // carries fullAddress (see PUBLIC_CHARGER_SELECT on the backend) — the
  // real address only exists behind the booking-detail endpoint, scoped to
  // the driver on this specific booking, fetched fresh now that the
  // booking is real. Not read from `charger` directly.
  const [address, setAddress] = useState<string | null | undefined>(undefined); // undefined = still loading
  const [addressError, setAddressError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getBookingDetail(bookingId)
      .then((booking) => {
        if (!cancelled) setAddress(booking.charger.fullAddress);
      })
      .catch((err) => {
        if (!cancelled) setAddressError(err instanceof ApiError ? err.message : "Couldn't load the address — try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 60, paddingHorizontal: 24, alignItems: "center" }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tokens.cyanTint10, borderWidth: 1, borderColor: tokens.cyanTint30, alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
        <Check size={28} color={tokens.cyan} strokeWidth={2.5} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 22, color: tokens.text, marginBottom: 8 }}>Booking confirmed</Text>
      <Text style={{ fontSize: 13.5, color: tokens.textSoft, textAlign: "center", lineHeight: 19, marginBottom: 28 }}>
        {charger.title} · {nameFor(charger)}{"\n"}
        {dateLabel(details.arrival)} · {formatTimeOfDay(details.arrival)} – {formatTimeWithDay(details.endTime, details.arrival)}
      </Text>

      <View style={{ width: "100%", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 18, marginBottom: 32 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Exact address</Text>
        {address === undefined && !addressError ? (
          <ActivityIndicator color={tokens.cyan} style={{ alignSelf: "flex-start", marginTop: 2 }} />
        ) : (
          <Text style={{ fontSize: 14, color: tokens.text }}>
            {addressError || address || `Not yet added by host — use ${charger.postcode} for now.`}
          </Text>
        )}
        {mapsUrl && (
          <Pressable onPress={() => Linking.openURL(mapsUrl)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
            <MapPin size={13} color={tokens.cyan} />
            <Text style={{ fontSize: 12.5, fontWeight: "500", color: tokens.cyan }}>Get directions</Text>
          </Pressable>
        )}
      </View>

      {startError && (
        <Text style={{ fontSize: 12, color: tokens.danger, textAlign: "center", marginBottom: 12 }}>{startError}</Text>
      )}

      <View style={{ width: "100%", gap: 10, marginTop: "auto", paddingBottom: 24 }}>
        <PrimaryButton
          disabled={starting}
          onPress={async () => {
            setStartError(null);
            setStarting(true);
            try {
              await session.start(charger, bookingId, details.arrival, details.endTime);
              // ActiveSession lives on the root stack, two levels up from
              // here: this Discover stack -> the tab navigator -> root stack.
              // getParent's generic lets this stay typed against
              // RootStackParamList rather than falling back to `any`.
              navigation
                .getParent()
                ?.getParent<NativeStackNavigationProp<RootStackParamList>>()
                ?.navigate("ActiveSession", { charger });
            } catch (err) {
              setStartError(err instanceof Error ? err.message : "Couldn't start the session — try again.");
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? <ActivityIndicator color={tokens.onAccent} /> : "Simulate arrival & start charging"}
        </PrimaryButton>
        <GhostButton onPress={() => navigation.popToTop()}>Back to Discover</GhostButton>
      </View>
    </View>
  );
}
