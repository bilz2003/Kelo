import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { BrandMark } from "@/components/Controls";
import { useTheme } from "@/theme/ThemeContext";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { tokens } = useTheme();

  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Pressable onPress={onDone} style={{ flex: 1, backgroundColor: tokens.ink, alignItems: "center", justifyContent: "center", gap: 14 }}>
      <BrandMark size={38} textSize={30} gap={11} />
      {/* Hardcoded, not fonts.mono — this exact tagline is a fixed piece of
          the brand presentation (like BrandMark's wordmark), not body copy
          that should track whatever the shared mono token is set to. Don't
          "fix" this to use fonts.mono; see theme/tokens.ts's fonts object
          comment for why. */}
      <Text style={{ fontFamily: "IBMPlexMono_400Regular", fontSize: 14, color: tokens.cyan, letterSpacing: 0.2 }}>verified, metered charging</Text>
    </Pressable>
  );
}
