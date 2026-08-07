import React from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts } from "@/theme/tokens";

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={17} color={tokens.text} />
          </Pressable>
        )}
        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 19, color: tokens.text, letterSpacing: -0.2 }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
