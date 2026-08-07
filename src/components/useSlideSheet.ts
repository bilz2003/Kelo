import { useLayoutEffect, useRef } from "react";
import { Animated, Dimensions } from "react-native";

const SLIDE_DISTANCE = Dimensions.get("window").height;

/**
 * Slide-up-from-bottom + fade-in-backdrop animation for the Modal-based
 * sheets (map pin details, TimeFilterButton, TimeSlotPicker,
 * ArrivalDatePicker). Pure classic Animated (not Reanimated) — a plain
 * timing/spring on transform + opacity doesn't need worklets, and
 * Reanimated was pulled from this project after it broke gestures twice.
 *
 * `translateY`'s ref is created already off-screen, so the very first
 * paint (before any effect has run) is already correct — no flash of the
 * resting position before the entrance animation kicks in. The entrance
 * itself runs in useLayoutEffect (fires before the native paint commits,
 * unlike useEffect) so a *re*-open after a prior close — where translateY
 * is sitting at 0 from last time — also resets cleanly before anything
 * is visible.
 */
export function useSlideSheet(open: boolean) {
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    if (!open) return;
    translateY.setValue(SLIDE_DISTANCE);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [open]);

  /** Slides the sheet the rest of the way off-screen and fades the backdrop, then calls onDone (which actually flips the state that unmounts the Modal). Continues from wherever translateY currently is — a mid-drag release doesn't snap back to rest first. */
  const animateOut = (onDone: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SLIDE_DISTANCE, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDone());
  };

  /** Drag released under the dismiss threshold — spring back to resting position. */
  const springBack = () => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
  };

  return { translateY, backdropOpacity, animateOut, springBack };
}
