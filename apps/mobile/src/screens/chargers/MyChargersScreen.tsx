import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Plus, Pencil, ChevronRight, Car, CalendarClock } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Toggle, PulseDot } from "@/components/Controls";
import { GhostButton, PrimaryButton } from "@/components/Button";
import { TimeFilterButton } from "@/components/TimeFilterButton";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { useSession } from "@/state/SessionContext";
import { ExtensionRequestEvent } from "@/api/sessions";
import { getNextBookingForHost, NextHostBooking } from "@/api/bookings";
import { computeSessionFinancials } from "@kelo/core";
import { statsForRange } from "@/data/mockBookings";
import { defaultTimeRange, dateLabel, formatTimeOfDay, formatTimeWithDay } from "@kelo/core";
import { Charger, TimeRangeValue } from "@kelo/core";

function MyChargerCard({
  charger, name, available, onToggleAvailable, onEdit, isCharging, liveKwh, liveSeconds, pendingExtension, onRespondExtension,
}: {
  charger: Charger; name: string; available: boolean; onToggleAvailable: () => void; onEdit: () => void;
  isCharging: boolean; liveKwh: number; liveSeconds: number;
  pendingExtension: ExtensionRequestEvent | null;
  onRespondExtension: (approve: boolean) => Promise<void>;
}) {
  const { tokens } = useTheme();
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  const live = isCharging ? computeSessionFinancials(charger, liveKwh, liveSeconds) : null;

  const respond = async (approve: boolean) => {
    if (responding) return;
    setRespondError(null);
    setResponding(true);
    try {
      await onRespondExtension(approve);
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : "Couldn't send your response — try again.");
    } finally {
      setResponding(false);
    }
  };

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
          <View style={{ flexDirection: "row", gap: 10, marginBottom: pendingExtension?.status === "pending" ? 12 : 0 }}>
            <View style={{ flex: 1, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: tokens.text }}>{liveKwh.toFixed(3)}</Text>
              <Text style={{ fontSize: 9.5, color: tokens.textSoft }}>kWh so far</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: live.idleChargesActive ? tokens.danger : tokens.hair, borderRadius: radii.md, padding: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: tokens.text }}>£{live.hostNet.toFixed(2)}</Text>
              <Text style={{ fontSize: 9.5, color: tokens.textSoft }}>{live.idleChargesActive ? "earning so far, incl. idle" : "earning so far"}</Text>
            </View>
          </View>

          {pendingExtension?.status === "pending" && (
            <View style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <CalendarClock size={14} color={tokens.textSoft} />
                <Text style={{ flex: 1, fontSize: 12.5, color: tokens.text, lineHeight: 17 }}>
                  Driver asked to extend until {new Date(pendingExtension.requestedEndAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
              {respondError && <Text style={{ fontSize: 11.5, color: tokens.danger, marginBottom: 8 }}>{respondError}</Text>}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton onPress={() => respond(true)} style={{ paddingVertical: 9 }}>
                    {responding ? <ActivityIndicator color={tokens.onAccent} /> : "Approve"}
                  </PrimaryButton>
                </View>
                <View style={{ flex: 1 }}>
                  <GhostButton onPress={() => respond(false)} tone="danger" style={{ paddingVertical: 9 }}>
                    Decline
                  </GhostButton>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.hair }}>
          <Text style={{ fontSize: 13.5, color: tokens.text }}>Available for booking</Text>
          <Toggle on={available} onToggle={onToggleAvailable} />
        </View>
      )}

      <Pressable onPress={onEdit} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14 }}>
        <Pencil size={14} color={tokens.textSoft} />
        <Text style={{ flex: 1, fontSize: 13.5, color: tokens.text }}>Edit charger details</Text>
        <ChevronRight size={15} color={tokens.textSoft} />
      </Pressable>
    </View>
  );
}

export function MyChargersScreen({ onAdd, onEdit }: { onAdd: () => void; onEdit: (id: number) => void }) {
  const { tokens } = useTheme();
  const { myChargers, nameFor } = useChargerStore();
  const session = useSession();
  const [availability, setAvailability] = useState<Record<number, boolean>>({});
  const [myCarOverride, setMyCarOverride] = useState(false);
  const [statsRange, setStatsRange] = useState<TimeRangeValue>(defaultTimeRange());
  // undefined = not loaded yet (render nothing, avoid a false-empty flash);
  // null = loaded, confirmed nothing upcoming (render the honest empty state).
  const [nextBooking, setNextBooking] = useState<NextHostBooking | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const s = statsForRange(statsRange.start, statsRange.end);
  const statCards: [string, string][] = [
    ["Sessions", String(s.sessions)],
    ["kWh delivered", s.kwh.toFixed(1)],
    ["Earned", `£${s.earned.toFixed(2)}`],
  ];

  const loadNextBooking = useCallback(async () => {
    try {
      const result = await getNextBookingForHost();
      setNextBooking(result);
    } catch {
      // Leave whatever was last successfully loaded rather than flashing
      // an incorrect empty state on a transient network error.
    }
  }, []);

  // Real data, not a mock — refetched every time this tab regains focus
  // (this screen stays mounted across tab switches, so a one-time
  // on-mount fetch alone wouldn't pick up a booking that's since gone
  // no-show or been released early) plus pull-to-refresh below.
  useFocusEffect(
    useCallback(() => {
      loadNextBooking();
    }, [loadNextBooking]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNextBooking();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3 }}>My chargers</Text>
        <Pressable onPress={onAdd} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.cyan, alignItems: "center", justifyContent: "center" }}>
          <Plus size={17} color={tokens.onAccent} />
        </Pressable>
      </View>

      <FlatList
        data={myChargers}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <View style={{ marginBottom: 14 }}>
              <TimeFilterButton value={statsRange} onChange={setStatsRange} />
            </View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
              Across all chargers · {statsRange.label}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {statCards.map(([k, v]) => (
                <View key={k} style={{ flex: 1, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 13, alignItems: "center" }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 17, color: tokens.text, marginBottom: 4 }}>{v}</Text>
                  <Text style={{ fontSize: 10, color: tokens.textSoft }}>{k}</Text>
                </View>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, paddingVertical: 24, paddingHorizontal: 20, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: tokens.text, marginBottom: 4 }}>No chargers listed</Text>
            <Text style={{ fontSize: 12.5, color: tokens.textSoft, lineHeight: 18, textAlign: "center" }}>
              Tap + above to add your first charger and start earning.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MyChargerCard
            charger={item}
            name={nameFor(item)}
            available={availability[item.id] ?? true}
            onToggleAvailable={() => setAvailability((prev) => ({ ...prev, [item.id]: !(prev[item.id] ?? true) }))}
            onEdit={() => onEdit(item.id)}
            isCharging={session.active && session.charger?.id === item.id}
            liveKwh={session.kwh}
            liveSeconds={session.seconds}
            pendingExtension={session.charger?.id === item.id ? session.pendingExtension : null}
            onRespondExtension={session.respondToExtension}
          />
        )}
        ListFooterComponent={
          <View>
            {nextBooking === null ? (
              <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: tokens.textSoft, marginBottom: 6 }}>Next booking</Text>
                <Text style={{ fontSize: 13.5, color: tokens.text }}>No upcoming bookings right now.</Text>
              </View>
            ) : nextBooking ? (
              <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: tokens.textSoft }}>Next booking</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: tokens.cyan }}>Upcoming</Text>
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, letterSpacing: 0.4, marginTop: 8, marginBottom: 2 }}>
                  {nextBooking.charger.title}
                </Text>
                <Text style={{ fontSize: 14, color: tokens.text }}>
                  {nextBooking.driver.name} · {dateLabel(new Date(nextBooking.arrivalAt))}{" "}
                  {formatTimeOfDay(new Date(nextBooking.arrivalAt))} – {formatTimeWithDay(new Date(nextBooking.endAt), new Date(nextBooking.arrivalAt))}
                </Text>
              </View>
            ) : null}

            {myChargers.length > 0 && (
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
            )}
          </View>
        }
      />
    </View>
  );
}
