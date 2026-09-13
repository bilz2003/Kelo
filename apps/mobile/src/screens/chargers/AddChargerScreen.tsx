import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Lock, ShieldCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton, GhostButton } from "@/components/Button";
import { Chip, Toggle } from "@/components/Controls";
import { CurrencyField } from "@/components/CurrencyField";
import { PhotosField } from "@/components/PhotosField";
import { useChargerStore, namesMatch } from "@/state/ChargerStoreContext";
import { useAuth } from "@/state/AuthContext";
import { createCharger, startEnodeLink, resolveEnodeLink, startOcppOnboarding, getOcppConnectionStatus } from "@/api/chargers";
import { PhotoDraft } from "@/api/photos";
import { ApiError } from "@/api/client";
import { CHARGER_MODELS, ROUTE_NOTES } from "@/data/mockChargers";
import { ChargerModelOption, deriveIdleAndOverstayRates } from "@kelo/core";

// Enode's own real Link redirect — must match EnodeLinkService's fixed
// REDIRECT_URI on the backend exactly (see that file's own comment on
// why it's not client-suppliable), and app.json's own "scheme": "kelo".
const ENODE_REDIRECT_URI = "kelo://enode-link-callback";

// A few short, real polling attempts after a successful Link redirect —
// not a single immediate check. Enode's own device-discovery isn't
// necessarily instantaneous the moment the hosted Link UI redirects
// back, so this gives real propagation a real chance before reporting
// failure.
const RESOLVE_LINK_ATTEMPTS = 4;
const RESOLVE_LINK_DELAY_MS = 1500;

type EnodeLinkState = "idle" | "linking" | "resolving" | "linked" | "failed";

// idle -> starting (minting a chargePointId) -> details (host is copying
// them into their charger) -> checking (a manual "Check connection" poll)
// -> connected once getOcppConnectionStatus genuinely reports true.
// "details" and "checking" both keep the connection-details box visible —
// checking just overlays a spinner on the check button.
type OcppOnboardingState = "idle" | "starting" | "details" | "checking" | "connected" | "failed";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AddChargerScreen({ onBack, onAdded }: { onBack: () => void; onAdded: () => void }) {
  const { tokens } = useTheme();
  const { siblingNames } = useChargerStore();
  const { user } = useAuth();

  const [model, setModel] = useState<ChargerModelOption | null>(null);
  const [postcode, setPostcode] = useState("");
  const [cableProvided, setCableProvided] = useState(true);
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [rate, setRate] = useState(0.3);
  // Live, per-keystroke draft of the rate field — separate from `rate`
  // itself (which only updates on blur/commit, like every other
  // CurrencyField) so the derived idle/overstay preview below updates
  // instantly as the host types, not just after they tab away. Falls
  // back to the committed `rate` whenever the draft doesn't parse to a
  // real positive number (empty, mid-edit like "0.", etc).
  const [rateDraft, setRateDraft] = useState(String(0.3));
  const [noShowFee, setNoShowFee] = useState(3.0);
  const [hostCost, setHostCost] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real, hard-gated Enode Link state — not a soft warning. enodeChargerId
  // only ever gets set once resolveEnodeLink has independently confirmed
  // (against Enode's own API, server-side) that a real device now exists
  // under this host's account that wasn't there before this attempt.
  const [enodeLinkState, setEnodeLinkState] = useState<EnodeLinkState>("idle");
  const [enodeChargerId, setEnodeChargerId] = useState<string | null>(null);
  const [enodeLinkMessage, setEnodeLinkMessage] = useState<string | null>(null);

  // Same hard-gated shape as Enode's Link state above — ocppChargePointId
  // only ever reaches "connected" once getOcppConnectionStatus has
  // independently confirmed (against OcppCentralSystem's own live
  // connection map, server-side) that a real charge point has connected
  // under this exact identity.
  const [ocppState, setOcppState] = useState<OcppOnboardingState>("idle");
  const [ocppChargePointId, setOcppChargePointId] = useState<string | null>(null);
  const [ocppWsUrl, setOcppWsUrl] = useState<string | null>(null);
  const [ocppMessage, setOcppMessage] = useState<string | null>(null);

  const selectModel = (m: ChargerModelOption) => {
    setModel(m);
    // Switching models mid-flow invalidates whatever was just linked —
    // a device linked for one model shouldn't silently attach itself to
    // a different one picked afterward.
    setEnodeLinkState("idle");
    setEnodeChargerId(null);
    setEnodeLinkMessage(null);
    setOcppState("idle");
    setOcppChargePointId(null);
    setOcppWsUrl(null);
    setOcppMessage(null);
  };

  const startLink = async () => {
    if (!model || model.route !== "enode") return;
    setEnodeLinkState("linking");
    setEnodeLinkMessage(null);
    try {
      const { linkUrl, existingChargerIds } = await startEnodeLink();
      const result = await WebBrowser.openAuthSessionAsync(linkUrl, ENODE_REDIRECT_URI);
      if (result.type !== "success") {
        // Cancelled or dismissed — no charger record exists anywhere at
        // this point (nothing is created until real submission below,
        // and that's still hard-blocked), so there's nothing to clean up
        // here beyond resetting back to a retryable state.
        setEnodeLinkState("idle");
        setEnodeLinkMessage("Link cancelled — you can try again whenever you're ready.");
        return;
      }
      setEnodeLinkState("resolving");
      let resolvedId: string | null = null;
      for (let attempt = 0; attempt < RESOLVE_LINK_ATTEMPTS && !resolvedId; attempt++) {
        if (attempt > 0) await sleep(RESOLVE_LINK_DELAY_MS);
        const { chargerId } = await resolveEnodeLink(existingChargerIds);
        resolvedId = chargerId;
      }
      if (resolvedId) {
        setEnodeChargerId(resolvedId);
        setEnodeLinkState("linked");
      } else {
        setEnodeLinkState("failed");
        setEnodeLinkMessage("Couldn't confirm your charger was linked — try again.");
      }
    } catch (err) {
      setEnodeLinkState("failed");
      setEnodeLinkMessage(err instanceof ApiError ? err.message : "Couldn't start the connection — try again.");
    }
  };

  const startOcppOnboardingFlow = async () => {
    if (!model || model.route !== "ocpp") return;
    setOcppState("starting");
    setOcppMessage(null);
    try {
      const { chargePointId, wsUrl } = await startOcppOnboarding();
      setOcppChargePointId(chargePointId);
      setOcppWsUrl(wsUrl);
      setOcppState("details");
    } catch (err) {
      setOcppState("failed");
      setOcppMessage(err instanceof ApiError ? err.message : "Couldn't generate connection details — try again.");
    }
  };

  // A manual "Check connection" tap, not a background poll — a host is
  // meant to go configure their physical charger's own OCPP settings in
  // between, which happens outside this app entirely; there's nothing to
  // usefully poll for until they've actually done that and come back.
  const checkOcppConnection = async () => {
    if (!ocppChargePointId) return;
    setOcppState("checking");
    setOcppMessage(null);
    try {
      const { connected } = await getOcppConnectionStatus(ocppChargePointId);
      if (connected) {
        setOcppState("connected");
      } else {
        setOcppState("details");
        setOcppMessage("Not connected yet — double-check the details below are entered exactly, then try again.");
      }
    } catch (err) {
      setOcppState("details");
      setOcppMessage(err instanceof ApiError ? err.message : "Couldn't check connection status — try again.");
    }
  };

  const isOcppModel = model?.route === "ocpp";
  const isEnodeModel = model?.route === "enode";
  const enodeLinked = isEnodeModel && enodeLinkState === "linked" && !!enodeChargerId;
  const ocppConnected = isOcppModel && ocppState === "connected" && !!ocppChargePointId;

  const canSubmit =
    !!model &&
    postcode.trim().length > 0 &&
    (!isOcppModel || ocppConnected) &&
    (!isEnodeModel || enodeLinked);
  const existingNames = siblingNames(null);
  const isDuplicate = name.trim() !== "" && existingNames.some((n) => namesMatch(n, name));

  // Live preview only — the real values are computed and stored
  // server-side (ChargersService.create), from this exact same shared
  // formula, the moment this submits. Falls back to the last committed
  // `rate` while the draft is empty/unparseable (e.g. mid-edit).
  const previewRateValue = (() => {
    const n = parseFloat(rateDraft);
    return Number.isFinite(n) && n > 0 ? n : rate;
  })();
  const { idleRate, overstayRate } = deriveIdleAndOverstayRates(previewRateValue, model?.powerNum ?? 0);

  const submit = async () => {
    if (!model || !canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createCharger({
        postcode: postcode.trim().toUpperCase(),
        title: model.title,
        powerKw: model.powerNum,
        cable: cableProvided ? "TETHERED" : "BRING_YOUR_OWN",
        connector: "Type 2",
        listingName: name.trim() || undefined,
        rate,
        // idleRate/overstayRate deliberately not sent — the server now
        // derives and writes both itself (see ChargersService.create);
        // sending them would just be rejected (see CreateChargerDto).
        noShowFee,
        hostCost,
        connectionRoute: isOcppModel ? "OCPP" : "ENODE",
        enodeChargerId: enodeChargerId ?? undefined,
        ocppChargePointId: ocppChargePointId ?? undefined,
        available: true,
        photos: photos.map((p) => p.key),
      });
      onAdded();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't list this charger — try again.");
    } finally {
      setSubmitting(false);
    }
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
            <Chip key={m.title} active={model?.title === m.title} onPress={() => selectModel(m)}>{m.title}</Chip>
          ))}
        </ScrollView>
        {model && (
          <View style={{ backgroundColor: tokens.surface, borderLeftWidth: 2, borderLeftColor: tokens.cyan, borderTopRightRadius: radii.lg, borderBottomRightRadius: radii.lg, padding: 14, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: tokens.text, marginBottom: 4 }}>
              {model.power} · Type 2{cableProvided ? " · tethered" : ""}
            </Text>
            <Text style={{ fontSize: 12, color: tokens.textSoft, lineHeight: 17, marginBottom: isOcppModel || isEnodeModel ? 12 : 0 }}>{ROUTE_NOTES[model.route]}</Text>

            {isOcppModel && (
              <View>
                {ocppConnected ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.cyanTint10, borderWidth: 1, borderColor: tokens.cyanTint30, borderRadius: radii.md, padding: 12 }}>
                    <ShieldCheck size={15} color={tokens.cyan} />
                    <Text style={{ flex: 1, fontSize: 12.5, color: tokens.text }}>Charger connected — receiving real OCPP messages.</Text>
                  </View>
                ) : ocppState === "idle" || ocppState === "starting" || ocppState === "failed" ? (
                  <>
                    <GhostButton onPress={startOcppOnboardingFlow} disabled={ocppState === "starting"} style={{ paddingVertical: 11 }}>
                      {ocppState === "starting" ? (
                        <ActivityIndicator color={tokens.text} />
                      ) : (
                        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: tokens.text }}>
                          {ocppState === "failed" ? "Try again" : "Get connection details"}
                        </Text>
                      )}
                    </GhostButton>
                    {ocppMessage && (
                      <Text style={{ fontSize: 11.5, color: tokens.danger, lineHeight: 16, marginTop: 8 }}>{ocppMessage}</Text>
                    )}
                  </>
                ) : (
                  <View>
                    <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 16, marginBottom: 8 }}>
                      Enter these into your charger's own OCPP settings, exactly as shown:
                    </Text>
                    <View style={{ backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 12, marginBottom: 10 }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>WebSocket URL</Text>
                      <Text selectable style={{ fontFamily: fonts.mono, fontSize: 12, color: tokens.text, marginBottom: 10 }}>{ocppWsUrl}</Text>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Charge point ID</Text>
                      <Text selectable style={{ fontFamily: fonts.mono, fontSize: 12, color: tokens.text }}>{ocppChargePointId}</Text>
                    </View>
                    <GhostButton onPress={checkOcppConnection} disabled={ocppState === "checking"} style={{ paddingVertical: 11 }}>
                      {ocppState === "checking" ? <ActivityIndicator color={tokens.text} /> : <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: tokens.text }}>Check connection</Text>}
                    </GhostButton>
                    {ocppMessage && (
                      <Text style={{ fontSize: 11.5, color: tokens.textSoft, lineHeight: 16, marginTop: 8 }}>{ocppMessage}</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {isEnodeModel && (
              <View>
                {enodeLinked ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.cyanTint10, borderWidth: 1, borderColor: tokens.cyanTint30, borderRadius: radii.md, padding: 12 }}>
                    <ShieldCheck size={15} color={tokens.cyan} />
                    <Text style={{ flex: 1, fontSize: 12.5, color: tokens.text }}>Charger connected via Enode.</Text>
                  </View>
                ) : (
                  <>
                    <GhostButton
                      onPress={startLink}
                      disabled={enodeLinkState === "linking" || enodeLinkState === "resolving"}
                      style={{ paddingVertical: 11 }}
                    >
                      {enodeLinkState === "linking" || enodeLinkState === "resolving" ? (
                        <ActivityIndicator color={tokens.text} />
                      ) : (
                        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: tokens.text }}>
                          {enodeLinkState === "failed" ? "Try connecting again" : "Connect your charger"}
                        </Text>
                      )}
                    </GhostButton>
                    {enodeLinkMessage && (
                      <Text style={{ fontSize: 11.5, color: enodeLinkState === "failed" ? tokens.danger : tokens.textSoft, lineHeight: 16, marginTop: 8 }}>
                        {enodeLinkMessage}
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Postcode</Text>
        <TextInput
          value={postcode}
          onChangeText={setPostcode}
          placeholder="e.g. SM5 2QT"
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
          placeholder={user?.name ? `${user.name}'s driveway` : "e.g. Garage charger"}
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
          onDraftChange={setRateDraft}
          min={0.1}
          max={1.0}
          helper="What drivers compare between hosts. Kelo takes a 12% commission on this."
        />

        <CurrencyField
          label="Idle occupancy rate — from the moment charging finishes"
          unit="min"
          value={idleRate}
          onChange={() => {}}
          readOnly
          min={0}
          max={Infinity}
          helper="Automatically set at 1.5× your charging rate. Kelo takes a 12% commission."
        />

        <CurrencyField
          label="Overstay rate — after 15 min grace"
          unit="min"
          value={overstayRate}
          onChange={() => {}}
          readOnly
          min={0}
          max={Infinity}
          helper="Automatically set at 7× your charging rate. Kelo takes a 30% commission."
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

      {submitError && (
        <Text style={{ fontSize: 12, color: tokens.danger, textAlign: "center", paddingHorizontal: 20, marginBottom: 8 }}>{submitError}</Text>
      )}

      <View style={{ padding: 20, paddingBottom: 28, borderTopWidth: 1, borderTopColor: tokens.hair, backgroundColor: tokens.ink }}>
        <PrimaryButton onPress={submit} disabled={!canSubmit || submitting}>
          {submitting ? <ActivityIndicator color={tokens.onAccent} /> : "List this charger"}
        </PrimaryButton>
        {!canSubmit && (
          <Text style={{ marginTop: 10, fontSize: 11.5, color: tokens.textSoft, textAlign: "center" }}>
            {isOcppModel && !ocppConnected
              ? "Get your connection details and connect your charger before you can list it."
              : isEnodeModel && !enodeLinked
                ? "Connect your charger via Enode before you can list it."
                : "Pick a charger model and add your postcode to continue."}
          </Text>
        )}
      </View>
    </View>
  );
}
