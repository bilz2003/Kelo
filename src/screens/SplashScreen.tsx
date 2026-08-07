import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { BrandMark } from "@/components/Controls";
import { useTheme } from "@/theme/ThemeContext";
import { fonts } from "@/theme/tokens";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { tokens } = useTheme();

  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Pressable onPress={onDone} style={{ flex: 1, backgroundColor: tokens.ink, alignItems: "center", justifyContent: "center", gap: 14 }}>
      <BrandMark size={38} textSize={30} gap={11} />
      <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: tokens.cyan, letterSpacing: 0.2 }}>verified, metered charging</Text>
    </Pressable>
  );
}
