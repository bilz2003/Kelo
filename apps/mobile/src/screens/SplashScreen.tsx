import React, { useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { BrandMark } from "@/components/Controls";
import { useTheme } from "@/theme/ThemeContext";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { tokens } = useTheme();

  // Read via a ref, not as a useEffect dependency — a real caller (App.tsx)
  // passes an inline `onDone`, a new function identity on every one of its
  // own renders. App.tsx renders on every live session "tick" once
  // SessionContext resumes an already-active session at startup, roughly
  // once a second. A naive `useEffect(..., [onDone])` tears the timer down
  // and re-arms it on every one of those renders; since ticks can arrive
  // faster than this timer's own delay, it never gets an uninterrupted
  // window to fire and this screen never dismisses — confirmed live: 14
  // rearm/cleanup cycles, 0 fires, over 12s real time when the app boots
  // straight into an already-ticking session. Keeping the effect's own
  // dependency array empty makes the timer set up exactly once, on mount,
  // regardless of how often the caller re-renders or recreates onDone —
  // it always calls whatever the latest onDone is via the ref.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable
      onPress={() => onDoneRef.current()}
      style={{ flex: 1, backgroundColor: tokens.ink, alignItems: "center", justifyContent: "center", gap: 14 }}
    >
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
