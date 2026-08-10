import React from "react";
import { Animated, View } from "react-native";
import { PanGestureHandler, PanGestureHandlerGestureEvent, State, PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { useTheme } from "@/theme/ThemeContext";

const DISMISS_DISTANCE = 90; // px dragged down before it counts as "swipe to dismiss"
const DISMISS_VELOCITY = 800; // px/s — a quick flick dismisses even under the distance threshold

/**
 * Drag handle for the Modal-based bottom sheets (map pin details,
 * TimeFilterButton, TimeSlotPicker, ArrivalDatePicker). Deliberately small
 * in scope: the PanGestureHandler's touch target is just this handle bar,
 * not the sheet's scrollable content below it — attaching it to the whole
 * sheet would fight any inner ScrollView for the vertical pan gesture.
 *
 * `translateY` is owned by the parent sheet (shared via prop) so the whole
 * sheet visually follows the drag, not just the handle itself. This
 * component only recognizes the gesture and decides which outcome applies
 * — the parent (via useSlideSheet) owns how each outcome actually animates:
 * `onDismiss` continues the slide off-screen from wherever the drag let go
 * (not a snap-back-then-slide), `onCancel` springs back to resting position.
 */
export function SheetHandle({
  onDismiss, onCancel, translateY,
}: {
  onDismiss: () => void; onCancel: () => void; translateY: Animated.Value;
}) {
  const { tokens } = useTheme();

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = e.nativeEvent;
      if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
        onDismiss();
      } else {
        onCancel();
      }
    }
  };

  return (
    <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View style={{ alignItems: "center", paddingVertical: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.hair }} />
      </Animated.View>
    </PanGestureHandler>
  );
}
