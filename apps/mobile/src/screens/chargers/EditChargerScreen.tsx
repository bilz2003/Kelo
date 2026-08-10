import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { Lock } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton, GhostButton } from "@/components/Button";
import { Toggle } from "@/components/Controls";
import { CurrencyField } from "@/components/CurrencyField";
import { PhotosField } from "@/components/PhotosField";
import { useChargerStore, namesMatch } from "@/state/ChargerStoreContext";
import { defaultListingName } from "@/data/mockChargers";
import { Charger } from "@kelo/core";

export function EditChargerScreen({ chargerId, onBack }: { chargerId: number; onBack: () => void }) {
  const { tokens } = useTheme();
  const { myChargers, nameFor, setNameFor, updateCharger, removeCharger, siblingNames } = useChargerStore();
  const charger = myChargers.find((c) => c.id === chargerId);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Defensive: navigates back automatically if the charger disappears out
  // from under this screen (e.g. removed). Effect rather than a render-phase
  // call, since calling onBack() during render would update the parent's
  // state while this component is still rendering.
  useEffect(() => {
    if (!charger) onBack();
  }, [charger]);

  if (!charger) return null;

  const name = nameFor(charger);
  const isDuplicate = name.trim() !== "" && siblingNames(charger.id).some((n) => namesMatch(n, name));
  const onChargerChange = (patch: Partial<Charger>) => updateCharger(charger.id, patch);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <ScreenHeader title="Edit charger details" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontSize: 13, color: tokens.textSoft, marginBottom: 20 }}>{charger.title} · {charger.power}</Text>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Listing</Text>
        <View style={{ marginBottom: 18 }}>
          <Text style={{ marginBottom: 8, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>Listing name</Text>
          <TextInput
            value={name}
            onChangeText={(v) => setNameFor(charger.id, v)}
            placeholder={defaultListingName(charger)}
            placeholderTextColor={tokens.textSoft}
            maxLength={40}
            style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13.5, color: tokens.text }}
          />
          {isDuplicate ? (
            <Text style={{ marginTop: 6, fontSize: 11.5, color: tokens.danger, lineHeight: 17 }}>
              You already have another charger called this. Drivers won't be able to tell them apart — worth giving each a distinct name.
            </Text>
          ) : (
            <Text style={{ marginTop: 6, fontSize: 11.5, color: tokens.textSoft, lineHeight: 17 }}>
              What drivers see on Discover. Clear the field to reset it to "{defaultListingName(charger)}".
            </Text>
          )}
        </View>

        <PhotosField photos={charger.photos || []} onChange={(photos) => onChargerChange({ photos })} />

        <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 16, marginBottom: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "500", color: tokens.text, marginBottom: 2 }}>Cable</Text>
            <Text style={{ fontSize: 11.5, color: tokens.textSoft }}>
              {charger.cable === "Tethered cable" ? "You provide the tethered cable" : "Drivers bring their own cable"}
            </Text>
          </View>
          <Toggle
            on={charger.cable === "Tethered cable"}
            onToggle={() => onChargerChange({ cable: charger.cable === "Tethered cable" ? "Bring your own cable" : "Tethered cable" })}
          />
        </View>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Pricing & fees</Text>

        <CurrencyField
          label="Charging rate — shown publicly"
          unit="kWh"
          value={charger.rate}
          onChange={(v) => v !== undefined && onChargerChange({ rate: v })}
          min={0.1}
          max={1.0}
          helper="What drivers compare between hosts. Kelo takes a 12% commission on this."
        />

        <CurrencyField
          label="Idle occupancy rate — after charging finishes"
          unit="min"
          value={charger.idleRate}
          onChange={(v) => v !== undefined && onChargerChange({ idleRate: v })}
          min={0.05}
          max={1.0}
          helper="Starts 15 minutes after the car stops drawing power, for as long as it sits in the booked window without being released. Range £0.05–£1.00. Kelo takes a 12% commission."
        />

        <CurrencyField
          label="Overstay rate — after 15 min grace"
          unit="min"
          value={charger.overstayRate}
          onChange={(v) => v !== undefined && onChargerChange({ overstayRate: v })}
          min={0.25}
          max={5.0}
          helper="Charged automatically if a driver stays past their booked window. Range £0.25–£5.00. Kelo takes a 30% commission."
        />

        <CurrencyField
          label="Late-cancellation / no-show fee"
          unit="booking"
          value={charger.noShowFee}
          onChange={(v) => v !== undefined && onChargerChange({ noShowFee: v })}
          min={1.0}
          max={10.0}
          helper="Paid to you in full — Kelo takes no commission on this one. Range £1.00–£10.00."
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 12 }}>
          <Lock size={12} color={tokens.textSoft} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>Private — only visible to you</Text>
        </View>
        <CurrencyField
          label="Your electricity cost"
          unit="kWh"
          value={charger.hostCost}
          onChange={(v) => onChargerChange({ hostCost: v })}
          min={0}
          max={1.0}
          optional
          placeholder="Not set"
          helper="Optional. Lets Kelo show your real profit per session and in aggregate. Never shown to drivers. On a time-of-use tariff (Octopus Agile etc.)? Enter your average rate."
        />

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8, marginBottom: 12 }}>Remove charger</Text>
        {!confirmingRemove ? (
          <GhostButton onPress={() => setConfirmingRemove(true)} tone="danger">Remove this charger</GhostButton>
        ) : (
          <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: "rgba(232,132,107,0.35)", borderRadius: radii.lg, padding: 16 }}>
            <Text style={{ fontSize: 12.5, color: tokens.textSoft, lineHeight: 18, marginBottom: 14 }}>
              Remove <Text style={{ color: tokens.text }}>{name}</Text>? It'll disappear from Discover immediately and this can't be undone. Any upcoming bookings on it will be cancelled automatically, free of charge to the driver.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <GhostButton onPress={() => setConfirmingRemove(false)}>Cancel</GhostButton>
              </View>
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => removeCharger(charger.id)}
                  style={{ width: "100%", paddingVertical: 14, paddingHorizontal: 20, borderRadius: radii.lg, alignItems: "center", backgroundColor: tokens.danger }}
                >
                  <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 14, color: tokens.onAccent }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair, backgroundColor: tokens.ink }}>
        <PrimaryButton onPress={onBack}>Done</PrimaryButton>
      </View>
    </View>
  );
}
