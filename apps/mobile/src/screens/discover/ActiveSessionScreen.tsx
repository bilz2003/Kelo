import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { ChevronDown, Lock, Check, Clock, X } from "lucide-react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { PrimaryButton, GhostButton } from "@/components/Button";
import { PulseDot } from "@/components/Controls";
import { useSession } from "@/state/SessionContext";
import { RootStackParamList } from "@/navigation/types";
import { computeSessionFinancials, SESSION_FULL_AT_SECONDS } from "@kelo/core";

type Props = NativeStackScreenProps<RootStackParamList, "ActiveSession">;

export function ActiveSessionScreen({ navigation }: Props) {
  const { tokens } = useTheme();
  const session = useSession();
  const [dismissedFullPrompt, setDismissedFullPrompt] = useState(false);
  const [ending, setEnding] = useState(false);

  const charger = session.charger;
  if (!charger) {
    // Defensive: shouldn't happen since this screen is only ever pushed
    // right after session.start(), but avoids a crash if it somehow is.
    navigation.goBack();
    return null;
  }

  const { kwh, seconds } = session;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const isFull = seconds >= SESSION_FULL_AT_SECONDS;
  const { idleChargesActive, idleMinutesElapsed, idleCost, energyCost, totalCost } = computeSessionFinancials(charger, kwh, seconds);
  const showFullPrompt = isFull && !dismissedFullPrompt;

  const handleEndSession = () => {
    session.stopTicking();
    setEnding(true);
  };

  const handleMinimize = () => {
    session.hide();
    navigation.goBack();
  };

  const handleDone = () => {
    session.end();
    navigation.goBack();
  };

  if (ending) {
    const rows: [string, string][] = [
      ["Charging rate", `£${charger.rate.toFixed(2)} / kWh`],
      ["Energy delivered", `${kwh.toFixed(3)} kWh`],
      ["Energy cost", `£${energyCost.toFixed(2)}`],
    ];
    if (idleCost > 0) rows.push([`Idle occupancy (${idleMinutesElapsed} min)`, `£${idleCost.toFixed(2)}`]);

    return (
      <View style={{ flex: 1, backgroundColor: tokens.ink }}>
        <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, alignItems: "center" }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <X size={22} color={tokens.textSoft} />
          </View>
          <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 18, color: tokens.text, marginBottom: 4 }}>Session ended</Text>
          <Text style={{ fontSize: 12.5, color: tokens.textSoft, marginBottom: 28 }}>Power to the charger has stopped · {mm}:{ss} session</Text>

          <View style={{ width: "100%", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, paddingHorizontal: 16, marginBottom: 16 }}>
            {rows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: tokens.hair }}>
                <Text style={{ fontSize: 13, color: tokens.textSoft }}>{k}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.text }}>{v}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: tokens.text }}>Total charged</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: "500", color: tokens.text }}>£{totalCost.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={{ width: "100%", fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
            Verified from {charger.title}'s own meter — this is exactly what was delivered, never an estimate. The £1.49 service charge was already taken when you booked.
          </Text>
        </ScrollView>
        <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair }}>
          <PrimaryButton onPress={handleDone}>Done</PrimaryButton>
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
        <Text style={{ fontSize: 13, color: tokens.textSoft, marginTop: 2, marginBottom: 36 }}>kWh delivered · from {charger.title}'s meter</Text>

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

        {showFullPrompt ? (
          <View
            style={{
              backgroundColor: idleChargesActive ? "rgba(232,132,107,0.1)" : tokens.cyanTint10,
              borderWidth: 1,
              borderColor: idleChargesActive ? "rgba(232,132,107,0.35)" : tokens.cyanTint30,
              borderRadius: radii.lg,
              padding: 14,
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
                    ? `You're being charged £${charger.idleRate.toFixed(2)}/min because the car's been sitting idle in this booked space for over 15 minutes. Release now to stop it adding up.`
                    : "You're still booked until your chosen end time, and you have 15 minutes before any idle charge applies. Release the rest of it now so this driveway is free for someone else to book."}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton onPress={handleEndSession} style={{ paddingVertical: 11 }}>Release time & end</PrimaryButton>
              </View>
              <View style={{ flex: 1 }}>
                <GhostButton onPress={() => setDismissedFullPrompt(true)} style={{ paddingVertical: 11 }}>
                  {idleChargesActive ? "Dismiss" : "Keep charging"}
                </GhostButton>
              </View>
            </View>
          </View>
        ) : (
          <GhostButton onPress={handleEndSession} tone="danger">End session</GhostButton>
        )}
      </View>
    </View>
  );
}
