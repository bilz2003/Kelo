import React from "react";
import { Pressable, View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";

export function Chip({ active, children, onPress }: { active: boolean; children: React.ReactNode; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: active ? tokens.cyanTint30 : tokens.hair,
        backgroundColor: active ? tokens.cyanTint10 : tokens.surface,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: active ? tokens.cyan : tokens.textSoft }}>{children}</Text>
    </Pressable>
  );
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 44,
        height: 26,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: tokens.hair,
        backgroundColor: on ? tokens.cyan : tokens.surface2,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: on ? tokens.onAccent : tokens.textSoft,
        }}
      />
    </Pressable>
  );
}

/** The network-node logo mark — fixed brand colours, doesn't flip with theme (same reasoning as the web version: a logo's own artwork stays constant). */
export function BrandMark({ size = 18, textSize = 15, gap = 8 }: { size?: number; textSize?: number; gap?: number }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      <Svg width={size} height={size} viewBox="0 0 60 60">
        <Line x1="14" y1="18" x2="46" y2="18" stroke="#2C3540" strokeWidth={1.5} />
        <Line x1="14" y1="18" x2="14" y2="42" stroke="#2C3540" strokeWidth={1.5} />
        <Line x1="46" y1="18" x2="46" y2="42" stroke="#2C3540" strokeWidth={1.5} />
        <Line x1="14" y1="42" x2="46" y2="42" stroke="#2C3540" strokeWidth={1.5} />
        <Line x1="14" y1="18" x2="46" y2="42" stroke="#4FD8C4" strokeWidth={1.5} />
        <Circle cx="14" cy="18" r="4" fill="#4FD8C4" />
        <Circle cx="46" cy="42" r="4" fill="#4FD8C4" />
        <Circle cx="46" cy="18" r="3" fill="#222A34" stroke="#2C3540" />
        <Circle cx="14" cy="42" r="3" fill="#222A34" stroke="#2C3540" />
      </Svg>
      <Text style={{ fontFamily: fonts.display, fontSize: textSize, color: tokens.text, letterSpacing: -0.2 }}>
        kelo<Text style={{ color: tokens.cyan }}>.</Text>
      </Text>
    </View>
  );
}

/** Small pulsing live-indicator dot — reused everywhere the web version used the cyan pulse (live session, charging-now, minimized-session banner). */
export function PulseDot({ size = 6 }: { size?: number }) {
  const { tokens } = useTheme();
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.cyan, opacity }}
    />
  );
}
