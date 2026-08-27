import React, { useState } from "react";
import { View, Text, Pressable, Linking, ActivityIndicator } from "react-native";
import { Bell } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { PrimaryButton, GhostButton } from "@/components/Button";
import { requestAndRegisterPushToken } from "@/lib/pushNotifications";

/**
 * Shown once, right after a fresh login/registration succeeds (see
 * AppShell in App.tsx) — not on every cold launch. Asking cold, before
 * someone has any context for why Kelo would want to notify them, is
 * exactly the kind of prompt people reflexively deny; asking right after
 * they've just signed in, with a one-line reason attached, is the
 * contextual version.
 */
export function NotificationPermissionScreen({ onDone }: { onDone: () => void }) {
  const { tokens } = useTheme();
  const [requesting, setRequesting] = useState(false);
  // null = haven't tried yet. "settings" = denied and canAskAgain is
  // false (asking again would just silently re-deny — same distinction
  // PhotosField's photo-library permission flow already makes).
  const [deniedState, setDeniedState] = useState<"settings" | null>(null);

  const enable = async () => {
    setRequesting(true);
    const outcome = await requestAndRegisterPushToken();
    setRequesting(false);
    if (outcome.status === "denied") {
      if (!outcome.canAskAgain) {
        setDeniedState("settings");
        return;
      }
      // canAskAgain true but still not granted (user dismissed the OS
      // prompt without a definitive answer, or this is a platform that
      // allows re-asking) — let them tap Enable again, or just move on.
      onDone();
      return;
    }
    // "granted" or "token_error" both mean permission itself is settled —
    // nothing further to ask the person about here either way.
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 80, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tokens.cyanTint10, borderWidth: 1, borderColor: tokens.cyanTint30, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Bell size={28} color={tokens.cyan} strokeWidth={2} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 22, color: tokens.text, marginBottom: 10 }}>
        Stay on top of your chargers
      </Text>
      <Text style={{ fontSize: 14, color: tokens.textSoft, lineHeight: 20, marginBottom: 28 }}>
        Get notified the moment a driver requests more time, a new booking comes in, or your charging session ends — so you're never staring at the app waiting to find out.
      </Text>

      {deniedState === "settings" && (
        <View style={{ backgroundColor: "rgba(232,132,107,0.1)", borderWidth: 1, borderColor: "rgba(232,132,107,0.35)", borderRadius: radii.md, padding: 14, marginBottom: 20 }}>
          <Text style={{ fontSize: 12.5, color: tokens.text, lineHeight: 18, marginBottom: 8 }}>
            Notifications are turned off for Kelo. You can enable them anytime in Settings.
          </Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: tokens.cyan }}>Open Settings</Text>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <PrimaryButton onPress={enable} disabled={requesting}>
          {requesting ? <ActivityIndicator color={tokens.onAccent} /> : "Enable notifications"}
        </PrimaryButton>
        <GhostButton onPress={onDone}>Not now</GhostButton>
      </View>
    </View>
  );
}
