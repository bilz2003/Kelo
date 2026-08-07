import React, { useRef, useState } from "react";
import { View, Text, Pressable, Animated, LayoutChangeEvent } from "react-native";
import { PanGestureHandler, PanGestureHandlerGestureEvent, State, PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import Svg, { Line } from "react-native-svg";
import { MapPin } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts } from "@/theme/tokens";
import { Charger } from "@/types";
import { pinPosition } from "@/utils/map";

const WORLD_SCALE = 1.6; // the pannable world is 160% of the visible viewport, so there's room to drag

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Stylized, draggable postcode-level map (not real cartography — matches
 * the web prototype). Panning uses react-native-gesture-handler's classic
 * PanGestureHandler + Animated rather than the newer worklet-based Gesture
 * API, since that needs react-native-reanimated configured and this map's
 * interaction (drag within clamped bounds, tap a pin) doesn't need it.
 */
export function DiscoverMap({
  chargers, selectedId, onPinTap, onBackgroundTap,
}: {
  chargers: Charger[]; selectedId: number | undefined; onPinTap: (c: Charger) => void; onBackgroundTap: () => void;
}) {
  const { tokens } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const committed = useRef({ x: 0, y: 0 }); // base offset from the last completed drag
  const live = useRef({ x: 0, y: 0 }); // running offset during the active drag

  const boundX = (size.width * (WORLD_SCALE - 1)) / 2;
  const boundY = (size.height * (WORLD_SCALE - 1)) / 2;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = e.nativeEvent;
    const x = clamp(committed.current.x + translationX, -boundX, boundX);
    const y = clamp(committed.current.y + translationY, -boundY, boundY);
    live.current = { x, y };
    pan.setValue({ x, y });
  };

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      committed.current = live.current;
    }
  };

  const worldWidth = size.width * WORLD_SCALE;
  const worldHeight = size.height * WORLD_SCALE;
  const gridLines = { v: Math.ceil(worldWidth / 40), h: Math.ceil(worldHeight / 40) };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface, overflow: "hidden" }} onLayout={onLayout}>
      <PanGestureHandler minDist={10} onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
        <Animated.View style={{ flex: 1 }}>
          {size.width > 0 && (
            <Animated.View
              style={{
                position: "absolute",
                left: size.width / 2 - worldWidth / 2,
                top: size.height / 2 - worldHeight / 2,
                width: worldWidth,
                height: worldHeight,
                transform: pan.getTranslateTransform(),
              }}
            >
              <Pressable onPress={onBackgroundTap} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
                <Svg width={worldWidth} height={worldHeight} style={{ position: "absolute" }}>
                  {Array.from({ length: gridLines.v }).map((_, i) => (
                    <Line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={worldHeight} stroke={tokens.hair} strokeWidth={1} />
                  ))}
                  {Array.from({ length: gridLines.h }).map((_, i) => (
                    <Line key={`h${i}`} x1={0} y1={i * 40} x2={worldWidth} y2={i * 40} stroke={tokens.hair} strokeWidth={1} />
                  ))}
                </Svg>

                {/* Driver's own approximate area */}
                <View pointerEvents="none" style={{ position: "absolute", left: "46%", top: "50%", transform: [{ translateX: -6 }, { translateY: -6 }], alignItems: "center" }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tokens.textSoft, borderWidth: 2, borderColor: tokens.ink }} />
                  <Text style={{ marginTop: 3, fontFamily: fonts.mono, fontSize: 9.5, color: tokens.textSoft, backgroundColor: tokens.ink, paddingHorizontal: 5, borderRadius: 4 }}>You</Text>
                </View>
              </Pressable>

              {chargers.map((c) => {
                const pos = pinPosition(c);
                const active = selectedId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onPinTap(c)}
                    hitSlop={8}
                    style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: [{ translateX: -14 }, { translateY: -28 }], padding: 4 }}
                  >
                    <MapPin size={active ? 28 : 24} color={tokens.cyan} fill={active ? tokens.cyan : tokens.cyanTint10} strokeWidth={2} />
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      </PanGestureHandler>

      {!selectedId && (
        <Text pointerEvents="none" style={{ position: "absolute", bottom: 8, left: 10, right: 10, fontSize: 9.5, color: tokens.textSoft, fontFamily: fonts.mono }}>
          Drag to pan · tap a pin for details · postcode-level only
        </Text>
      )}
    </View>
  );
}
