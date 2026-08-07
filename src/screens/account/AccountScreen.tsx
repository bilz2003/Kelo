import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { CreditCard, Wallet, Car, Bell, HelpCircle, LogOut, Sun, Moon, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { Toggle } from "@/components/Controls";
import { GhostButton } from "@/components/Button";

const MENU = [
  { icon: CreditCard, label: "Payment methods" },
  { icon: Wallet, label: "Payout details" },
  { icon: Car, label: "Vehicles" },
  { icon: Bell, label: "Notifications" },
  { icon: HelpCircle, label: "Help & support" },
];

export function AccountScreen() {
  const { tokens, mode, toggleMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 24, color: tokens.text, letterSpacing: -0.3 }}>Account</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 18, color: tokens.cyan }}>SC</Text>
          </View>
          <View>
            <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 17, color: tokens.text, marginBottom: 4 }}>Sam Carter</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft }}>Host & Driver — one profile</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
          {[["4.9", "Rating"], ["32", "As host"], ["11", "As driver"]].map(([v, k]) => (
            <View key={k} style={{ flex: 1, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.lg, padding: 13, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 17, color: tokens.text, marginBottom: 4 }}>{v}</Text>
              <Text style={{ fontSize: 10, color: tokens.textSoft }}>{k}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, padding: 16, marginBottom: 16 }}>
          {mode === "light" ? <Sun size={16} color={tokens.textSoft} /> : <Moon size={16} color={tokens.textSoft} />}
          <Text style={{ flex: 1, fontSize: 13.5, color: tokens.text }}>Appearance — {mode === "light" ? "Light" : "Dark"}</Text>
          <Toggle on={mode === "light"} onToggle={toggleMode} />
        </View>

        <View style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.xl, overflow: "hidden", marginBottom: 16 }}>
          {MENU.map((item, i) => (
            <Pressable
              key={item.label}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: i < MENU.length - 1 ? 1 : 0, borderBottomColor: tokens.hair }}
            >
              <item.icon size={16} color={tokens.textSoft} />
              <Text style={{ flex: 1, fontSize: 13.5, color: tokens.text }}>{item.label}</Text>
              <ChevronRight size={15} color={tokens.textSoft} />
            </Pressable>
          ))}
        </View>

        <GhostButton onPress={() => {}} tone="danger">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LogOut size={14} color={tokens.danger} />
            <Text style={{ color: tokens.danger, fontFamily: fonts.bodyMedium, fontSize: 14 }}>Log out</Text>
          </View>
        </GhostButton>
      </ScrollView>
    </View>
  );
}
