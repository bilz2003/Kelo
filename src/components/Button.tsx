import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";

interface PrimaryButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ children, onPress, disabled, style }: PrimaryButtonProps) {
  const { tokens } = useTheme();
  const textColor = disabled ? tokens.textSoft : tokens.onAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: disabled ? tokens.hair : tokens.cyan,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={{ fontFamily: fonts.display, fontSize: 15, letterSpacing: -0.2, color: textColor }}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

interface GhostButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  tone?: "default" | "danger";
  style?: StyleProp<ViewStyle>;
}

export function GhostButton({ children, onPress, tone = "default", style }: GhostButtonProps) {
  const { tokens } = useTheme();
  const textColor = tone === "danger" ? tokens.danger : tokens.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: tone === "danger" ? "rgba(232,132,107,0.35)" : tokens.hair,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: textColor }}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
