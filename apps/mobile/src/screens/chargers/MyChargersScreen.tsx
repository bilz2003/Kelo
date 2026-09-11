import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Plus, Pencil, ChevronRight, Car, CalendarClock, TriangleAlert } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Toggle, PulseDot } from "@/components/Controls";
import { GhostButton, PrimaryButton } from "@/components/Button";
import { TimeFilterButton } from "@/components/TimeFilterButton";
import { useChargerStore } from "@/state/ChargerStoreContext";
import { useHostActiveSessions } from "@/state/useHostActiveSessions";
import { useAuth } from "@/state/AuthContext";
import { ExtensionRequestEvent } from "@/api/sessions";
import { getNextBookingForHost, NextHostBooking } from "@/api/bookings";
import { getChargerStats, ChargerStats } from "@/api/chargers";
import { ApiError } from "@/api/client";
import { computeSessionFinancials } from "@kelo/core";
import { defaultTimeRange, dateLabel, formatTimeOfDay, formatTimeWithDay } from "@kelo/core";
import { Charger, TimeRangeValue } from "@kelo/core";

function MyChargerCard({
  charger, name, onToggleAvailable, onEdit, isCharging, liveKwh, liveSeconds, pendingExtension, onRespondExtension,
}: {
  charger: Charger; name: string; onToggleAvailable: () => Promise<void>; onEdit: () => void;
  isCharging: boolean; liveKwh: number; liveSeconds: number;
  pendingExtension: ExtensionRequestEvent | null;
  onRespondExtension: (approve: boolean) => Promise<void>;
}) {
  const { tokens } = useTheme();
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
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

  const toggleAvailable = async () => {
    setToggleError(null);
    try {
      await onToggleAvailable();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Couldn't update availability — try again.");
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
        <View style={{ paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.hair }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13.5, color: tokens.text }}>Available for booking</Text>
            <Toggle on={charger.available} onToggle={toggleAvailable} />
          </View>
          {toggleError && <Text style={{ fontSize: 11.5, color: tokens.danger, marginTop: 8 }}>{toggleError}</Text>}
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
  const { myChargers, myChargersLoading, myChargersError, refetchMyChargers, toggleChargerAvailability, nameFor } = useChargerStore();
  const { user } = useAuth();
  // Host-side live session visibility — a genuinely separate mechanism
  // from the driver-facing SessionContext (see its own doc comment for
  // why conflating the two is the wrong model, even though it's this
  // screen's own charger's charging session, that session belongs to
  // whichever driver actually started it, quite possibly on a completely
  // different account/device).
  const hostSessions = useHostActiveSessions();
  const [myCarOverride, setMyCarOverride] = useState(false);
  const [statsRange, setStatsRange] = useState<TimeRangeValue>(defaultTimeRange());
  const [stats, setStats] = useState<ChargerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  // undefined = not loaded yet (render nothing, avoid a false-empty flash);
  // null = loaded, confirmed nothing upcoming (render the honest empty state).
  const [nextBooking, setNextBooking] = useState<NextHostBooking | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  // Real aggregation from the backend — refetched whenever the selected
  // period changes (this callback is keyed on start/end), so switching
  // periods never reuses the previous range's numbers. A refetch keeps the
  // prior values visible until it resolves rather than flashing "—".
  const loadStats = useCallback(async () => {
    setStatsError(null);
    setStatsLoading(true);
    try {
      setStats(await getChargerStats(statsRange.start, statsRange.end));
    } catch (err) {
      setStatsError(err instanceof ApiError ? err.message : "Couldn't load your stats — pull to refresh to try again.");
    } finally {
      setStatsLoading(false);
    }
  }, [statsRange.start, statsRange.end]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hasActivity = !!stats && (stats.sessions > 0 || stats.kwh > 0 || stats.earned > 0);
  const statCards: [string, string][] = [
    ["Sessions", stats ? String(stats.sessions) : "—"],
    ["kWh delivered", stats ? stats.kwh.toFixed(1) : "—"],
    ["Earned", stats ? `£${stats.earned.toFixed(2)}` : "—"],
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
  // no-show or been released early, or a charger edited/toggled from
  // elsewhere) plus pull-to-refresh below. user is always set here (this
  // screen only renders once authenticated) — the fallback is just to
  // satisfy the type without an unnecessary null check at the call site.
  // hostSessions.refresh() covers the same "just came back to this
  // screen" case for live sessions — a real session starting while this
  // screen wasn't focused is otherwise invisible until this fires (the
  // push-triggered refetch inside useHostActiveSessions covers the
  // still-focused case this alone would miss).
  useFocusEffect(
    useCallback(() => {
      loadNextBooking();
      refetchMyChargers(user?.name ?? "");
      hostSessions.refresh();
    }, [loadNextBooking, refetchMyChargers, user, hostSessions.refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNextBooking(), refetchMyChargers(user?.name ?? ""), loadStats(), hostSessions.refresh()]);
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

      {myChargersLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
          <ActivityIndicator color={tokens.cyan} />
        </View>
      ) : myChargersError ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 20, alignItems: "center" }}>
            <TriangleAlert size={18} color={tokens.danger} style={{ marginBottom: 8 }} />
            <Text style={{ color: tokens.textSoft, fontSize: 13, textAlign: "center", marginBottom: 14 }}>{myChargersError}</Text>
            <Pressable
              onPress={() => refetchMyChargers(user?.name ?? "")}
              style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingVertical: 8, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: tokens.text }}>Try again</Text>
            </Pressable>
          </View>
        </View>
      ) : (
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
            {statsError ? (
              <Pressable
                onPress={loadStats}
                style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 12.5, color: tokens.textSoft, textAlign: "center", lineHeight: 17 }}>{statsError}</Text>
                <Text style={{ fontSize: 12, fontWeight: "500", color: tokens.cyan, marginTop: 6 }}>Tap to retry</Text>
              </Pressable>
            ) : !statsLoading && stats && !hasActivity ? (
              <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 16, alignItems: "center" }}>
                <Text style={{ fontSize: 13.5, fontWeight: "500", color: tokens.text, marginBottom: 3 }}>
                  {statsRange.mode === "all" ? "No earnings yet" : `No earnings in ${statsRange.label}`}
                </Text>
                <Text style={{ fontSize: 11.5, color: tokens.textSoft, textAlign: "center", lineHeight: 16 }}>
                  Completed sessions and payouts across your chargers show here once drivers have charged.
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {statCards.map(([k, v]) => (
                  <View key={k} style={{ flex: 1, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 13, alignItems: "center" }}>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 17, color: tokens.text, marginBottom: 4 }}>{v}</Text>
                    <Text style={{ fontSize: 10, color: tokens.textSoft }}>{k}</Text>
                  </View>
                ))}
              </View>
            )}
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
        renderItem={({ item }) => {
          // From useHostActiveSessions — real server-discovered state for
          // whoever's actually driving at this charger, not this device's
          // own SessionContext. The card's own rendering logic is
          // unchanged from before; only where this data comes from is.
          const live = hostSessions.sessions.get(item.id);
          return (
            <MyChargerCard
              charger={item}
              name={nameFor(item)}
              onToggleAvailable={() => toggleChargerAvailability(item.id)}
              onEdit={() => onEdit(item.id)}
              isCharging={!!live}
              liveKwh={live?.kwh ?? 0}
              liveSeconds={live?.seconds ?? 0}
              pendingExtension={live?.pendingExtension ?? null}
              onRespondExtension={(approve) => hostSessions.respondToExtension(item.id, approve)}
            />
          );
        }}
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
      )}
    </View>
  );
}
