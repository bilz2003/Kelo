import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { ChevronDown, Lock, Check, Clock, X, Unplug } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { GhostButton } from "@/components/Button";
import { PulseDot } from "@/components/Controls";
import { useSession } from "@/state/SessionContext";
import { RootStackParamList } from "@/navigation/types";
import { computeSessionFinancials, SESSION_FULL_AT_SECONDS } from "@kelo/core";

type Props = NativeStackScreenProps<RootStackParamList, "ActiveSession">;

export function ActiveSessionScreen({ navigation }: Props) {
  const { tokens } = useTheme();
  const session = useSession();
  const [dismissedFullPrompt, setDismissedFullPrompt] = useState(false);
  const [unplugging, setUnplugging] = useState(false);
  const [unplugError, setUnplugError] = useState<string | null>(null);

  const charger = session.charger;
  const receipt = session.lastReceipt;

  if (!charger && !receipt) {
    // Defensive: shouldn't happen since this screen is only ever pushed
    // right after session.start(), but avoids a crash if it somehow is.
    navigation.goBack();
    return null;
  }

  const { kwh, seconds } = session;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const isFull = seconds >= SESSION_FULL_AT_SECONDS;
  const { idleChargesActive, idleCost, energyCost, totalCost } = charger
    ? computeSessionFinancials(charger, kwh, seconds)
    : { idleChargesActive: false, idleCost: 0, energyCost: 0, totalCost: 0 };
  const showFullPrompt = isFull && !dismissedFullPrompt;

  // Mock-only trigger, standing in for a real hardware unplug signal — this
  // is the ONLY thing that can end a session, and it's fire-and-forget:
  // nothing here reacts to the result. The receipt below is driven
  // entirely by session.lastReceipt, set when the session:ended event
  // arrives over the socket (see SessionContext), the same way it would
  // for a real unplug this screen didn't request.
  const handleSimulateUnplug = async () => {
    if (unplugging) return;
    setUnplugError(null);
    setUnplugging(true);
    try {
      await session.simulateUnplug();
    } catch (err) {
      setUnplugError(err instanceof Error ? err.message : "Couldn't reach the charger — try again.");
    } finally {
      setUnplugging(false);
    }
  };

  const handleMinimize = () => {
    session.hide();
    navigation.goBack();
  };

  const handleDone = () => {
    session.clearReceipt();
    navigation.goBack();
  };

  if (receipt) {
    const receiptMm = String(Math.floor(receipt.seconds / 60)).padStart(2, "0");
    const receiptSs = String(receipt.seconds % 60).padStart(2, "0");
    const rows: [string, string][] = [
      ["Charging rate", `£${receipt.charger.rate.toFixed(2)} / kWh`],
      ["Energy delivered", `${receipt.kwh.toFixed(3)} kWh`],
      ["Energy cost", `£${receipt.energyCost.toFixed(2)}`],
    ];
    if (receipt.idleCost > 0) rows.push([`Idle occupancy (${receipt.idleMinutesElapsed} min)`, `£${receipt.idleCost.toFixed(2)}`]);
    if (receipt.overstayCost > 0) rows.push([`Overstay (${receipt.overstayMinutesElapsed} min)`, `£${receipt.overstayCost.toFixed(2)}`]);

    return (
      <View style={{ flex: 1, backgroundColor: tokens.ink }}>
        <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <Unplug size={22} color={tokens.textSoft} />
          </View>
          <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 18, color: tokens.text, marginBottom: 4 }}>Session ended</Text>
          <Text style={{ fontSize: 12.5, color: tokens.textSoft, marginBottom: 8, textAlign: "center" }}>
            Charger reported unplugged · {receiptMm}:{receiptSs} session
          </Text>
          {receipt.released && (
            <Text style={{ fontSize: 12, color: tokens.cyan, marginBottom: 20, textAlign: "center" }}>
              {receipt.minutesReleased} min of your booked time has been released back for others to book.
            </Text>
          )}

          <View style={{ width: "100%", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 16, marginBottom: 16, marginTop: receipt.released ? 0 : 12 }}>
            {rows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: tokens.hair }}>
                <Text style={{ fontSize: 13, color: tokens.textSoft }}>{k}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{v}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.text }}>Total charged</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: "500", color: tokens.text }}>£{receipt.totalCost.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={{ width: "100%", fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
            Verified from {receipt.charger.title}'s own meter — this is exactly what was delivered, never an estimate. The £1.49 service charge was already taken when you booked.
          </Text>
        </ScrollView>
        <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair }}>
          <GhostButton onPress={handleDone}>Done</GhostButton>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 54, paddingHorizontal: 20 }}>
        <Pressable
          onPress={handleMinimize}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.cyanTint30, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronDown size={17} color={tokens.cyan} strokeWidth={2.3} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <PulseDot size={5} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>Live session</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ fontFamily: fonts.mono, fontWeight: "500", fontSize: 56, color: tokens.text, letterSpacing: -0.5 }}>{kwh.toFixed(3)}</Text>
        <Text style={{ fontSize: 13, color: tokens.textSoft, marginTop: 2, marginBottom: 36 }}>kWh delivered · from {charger?.title}'s meter</Text>

        <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
          <View style={{ flex: 1, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 14, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Session time</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 20, color: tokens.text }}>{mm}:{ss}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: tokens.surface, borderWidth: 1, borderColor: idleChargesActive ? tokens.danger : tokens.hair, borderRadius: radii.lg, padding: 14, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Running cost</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 20, color: tokens.text }}>£{totalCost.toFixed(2)}</Text>
            {idleChargesActive && <Text style={{ fontSize: 10, color: tokens.danger, fontFamily: fonts.mono, marginTop: 3 }}>incl. £{idleCost.toFixed(2)} idle</Text>}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Lock size={12} color={tokens.textSoft} />
          <Text style={{ fontSize: 11.5, color: tokens.textSoft }}>No tap, no power — this session was authorized by Kelo</Text>
        </View>

        {showFullPrompt && (
          <View
            style={{
              backgroundColor: idleChargesActive ? "rgba(232,132,107,0.1)" : tokens.cyanTint10,
              borderWidth: 1,
              borderColor: idleChargesActive ? "rgba(232,132,107,0.35)" : tokens.cyanTint30,
              borderRadius: radii.lg,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {idleChargesActive ? <Clock size={15} color={tokens.danger} style={{ marginTop: 1 }} /> : <Check size={15} color={tokens.cyan} style={{ marginTop: 1 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: tokens.text, marginBottom: 4 }}>
                  {idleChargesActive ? "Idle occupancy charges have started" : "Car looks fully charged"}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.textSoft, lineHeight: 17 }}>
                  {idleChargesActive
                    ? `You're being charged £${charger?.idleRate.toFixed(2)}/min because the car's been sitting idle in this booked space for over 15 minutes. This continues until the charger reports you've unplugged.`
                    : "You're still within your booked window, with 15 minutes before any idle charge applies. Charging keeps running until the charger reports you've unplugged."}
                </Text>
              </View>
            </View>
            <GhostButton onPress={() => setDismissedFullPrompt(true)} style={{ paddingVertical: 11 }}>
              Got it
            </GhostButton>
          </View>
        )}

        {unplugError && (
          <Text style={{ fontSize: 12, color: tokens.danger, textAlign: "center", marginBottom: 10 }}>{unplugError}</Text>
        )}

        <View
          style={{
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: tokens.hair,
            borderRadius: radii.lg,
            padding: 12,
          }}
        >
          <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, textAlign: "center" }}>
            Test tool — not part of the real product
          </Text>
          <GhostButton onPress={handleSimulateUnplug}>
            {unplugging ? (
              <ActivityIndicator color={tokens.text} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Unplug size={14} color={tokens.text} />
                <Text style={{ color: tokens.text, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Simulate unplug (test only)</Text>
              </View>
            )}
          </GhostButton>
        </View>
      </View>
    </View>
  );
}
