import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { Lock } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/Button";
import { Chip, Toggle } from "@/components/Controls";
import { CurrencyField } from "@/components/CurrencyField";
import { PhotosField } from "@/components/PhotosField";
import { useChargerStore, namesMatch } from "@/state/ChargerStoreContext";
import { CHARGER_MODELS, ROUTE_NOTES } from "@/data/mockChargers";
import { ChargerModelOption } from "@kelo/core";

export function AddChargerScreen({ onBack, onAdded }: { onBack: () => void; onAdded: () => void }) {
  const { tokens } = useTheme();
  const { hostIdentity, addCharger, siblingNames } = useChargerStore();

  const [model, setModel] = useState<ChargerModelOption | null>(null);
  const [postcode, setPostcode] = useState("");
  const [cableProvided, setCableProvided] = useState(true);
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rate, setRate] = useState(0.3);
  const [idleRate, setIdleRate] = useState(0.15);
  const [overstayRate, setOverstayRate] = useState(1.0);
  const [noShowFee, setNoShowFee] = useState(3.0);
  const [hostCost, setHostCost] = useState<number | undefined>(undefined);

  const canSubmit = !!model && postcode.trim().length > 0;
  const existingNames = siblingNames(null);
  const isDuplicate = name.trim() !== "" && existingNames.some((n) => namesMatch(n, name));

  const submit = () => {
    if (!model || !canSubmit) return;
    addCharger(
      {
        host: hostIdentity.host,
        initials: hostIdentity.initials,
        postcode: postcode.trim().toUpperCase(),
        title: model.title,
        power: model.power,
        powerNum: model.powerNum,
        cable: cableProvided ? "Tethered cable" : "Bring your own cable",
        connector: "Type 2",
        rate,
        idleRate,
        overstayRate,
        noShowFee,
        hostCost,
        photos,
        distance: "0.3 mi",
        rating: null,
        sessions: 0,
        available: true,
      },
      name.trim()
    );
    onAdded();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <ScreenHeader title="Add a charger" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontSize: 13, color: tokens.textSoft, lineHeight: 19, marginBottom: 20 }}>
          Add your home charger to start earning. Every session is billed from its own verified meter, never an estimate.
        </Text>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Your charger</Text>
        {/* marginHorizontal: -20 breaks this out of the parent ScrollView's own
            horizontal padding, so it reaches the true screen edges — same effect
            Discover's filter/radius scrollers get by not being nested in a padded
            parent at all. contentContainerStyle then re-adds that 20px as scroll
            content padding, matching Discover's pattern exactly. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
          style={{ marginHorizontal: -20, marginBottom: model ? 12 : 20 }}
        >
          {CHARGER_MODELS.map((m) => (
            <Chip key={m.title} active={model?.title === m.title} onPress={() => setModel(m)}>{m.title}</Chip>
          ))}
        </ScrollView>
        {model && (
          <View style={{ backgroundColor: tokens.surface, borderLeftWidth: 2, borderLeftColor: tokens.cyan, borderTopRightRadius: radii.lg, borderBottomRightRadius: radii.lg, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: tokens.text, marginBottom: 4 }}>
              {model.power} · Type 2{cableProvided ? " · tethered" : ""}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.textSoft, lineHeight: 17 }}>{ROUTE_NOTES[model.route]}</Text>
          </View>
        )}

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Postcode</Text>
        <TextInput
          value={postcode}
          onChangeText={setPostcode}
          placeholder="e.g. SM5"
          placeholderTextColor={tokens.textSoft}
          maxLength={8}
          autoCapitalize="characters"
          style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13.5, color: tokens.text, marginBottom: 8 }}
        />
        <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17, marginBottom: 20 }}>
          Drivers only see this postcode-level area before booking. Your exact address is released once a booking is confirmed and paid.
        </Text>

        <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 16, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: "500", color: tokens.text, marginBottom: 2 }}>Cable</Text>
            <Text style={{ fontSize: 11.5, color: tokens.textSoft }}>
              {cableProvided ? "You provide the tethered cable" : "Drivers bring their own cable"}
            </Text>
          </View>
          <Toggle on={cableProvided} onToggle={() => setCableProvided((v) => !v)} />
        </View>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Listing name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={hostIdentity.host ? `${hostIdentity.host}'s driveway` : "e.g. Garage charger"}
          placeholderTextColor={tokens.textSoft}
          maxLength={40}
          style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13.5, color: tokens.text, marginBottom: 8 }}
        />
        {isDuplicate ? (
          <Text style={{ fontSize: 11.5, color: tokens.danger, lineHeight: 17, marginBottom: 24 }}>
            You already have another charger called this. Drivers won't be able to tell them apart — worth giving each a distinct name.
          </Text>
        ) : (
          <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 17, marginBottom: 24 }}>
            What drivers see on Discover. Leave blank to use the default — worth customising if you're listing more than one charger.
          </Text>
        )}

        <PhotosField photos={photos} onChange={setPhotos} />

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Pricing & fees</Text>

        <CurrencyField
          label="Charging rate — shown publicly"
          unit="kWh"
          value={rate}
          onChange={(v) => v !== undefined && setRate(v)}
          min={0.1}
          max={1.0}
          helper="What drivers compare between hosts. Kelo takes a 12% commission on this."
        />

        <CurrencyField
          label="Idle occupancy rate — after charging finishes"
          unit="min"
          value={idleRate}
          onChange={(v) => v !== undefined && setIdleRate(v)}
          min={0.05}
          max={1.0}
          helper="Starts 15 minutes after the car stops drawing power, for as long as it sits in the booked window without being released. Range £0.05–£1.00. Kelo takes a 12% commission."
        />

        <CurrencyField
          label="Overstay rate — after 15 min grace"
          unit="min"
          value={overstayRate}
          onChange={(v) => v !== undefined && setOverstayRate(v)}
          min={0.25}
          max={5.0}
          helper="Charged automatically if a driver stays past their booked window. Range £0.25–£5.00. Kelo takes a 30% commission."
        />

        <CurrencyField
          label="Late-cancellation / no-show fee"
          unit="booking"
          value={noShowFee}
          onChange={(v) => v !== undefined && setNoShowFee(v)}
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
          value={hostCost}
          onChange={setHostCost}
          min={0}
          max={1.0}
          optional
          placeholder="Not set"
          helper="Optional. Lets Kelo show your real profit per session and in aggregate. Never shown to drivers."
        />
      </ScrollView>

      <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair, backgroundColor: tokens.ink }}>
        <PrimaryButton onPress={submit} disabled={!canSubmit}>List this charger</PrimaryButton>
        {!canSubmit && (
          <Text style={{ marginTop: 10, fontSize: 11.5, color: tokens.textSoft, textAlign: "center" }}>
            Pick a charger model and add your postcode to continue.
          </Text>
        )}
      </View>
    </View>
  );
}
