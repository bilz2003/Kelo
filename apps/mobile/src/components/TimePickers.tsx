import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Animated } from "react-native";
import { Clock, ChevronDown, Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { SheetHandle } from "@/components/SheetHandle";
import { useSlideSheet } from "@/components/useSlideSheet";
import {
  timeSlots, formatTimeWithDay, calendarCells, monthLabel, startOfMonth, addMonths,
  isSameDate, dateLabel, startOfDay, NOW, MAX_ADVANCE_DAYS, WEEKDAY_LETTERS,
} from "@kelo/core";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Exact time-of-day picker (15-min increments) — button that opens a modal list. */
export function TimeSlotPicker({
  label, value, onChange, min, max, anchor,
}: {
  label: string; value: Date; onChange: (d: Date) => void; min: Date; max: Date; anchor: Date;
}) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const slots = timeSlots(min, max);
  const { translateY: sheetTranslateY, backdropOpacity, animateOut, springBack } = useSlideSheet(open);
  const close = () => animateOut(() => setOpen(false));

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ marginBottom: 8, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 14 }}
      >
        <Clock size={14} color={tokens.cyan} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: tokens.text }}>{formatTimeWithDay(value, anchor)}</Text>
        <ChevronDown size={14} color={tokens.textSoft} style={{ marginLeft: "auto" }} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <AnimatedPressable
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(18,22,28,0.6)", opacity: backdropOpacity }}
            onPress={close}
          />
          <Animated.View style={{ backgroundColor: tokens.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, maxHeight: "60%", transform: [{ translateY: sheetTranslateY }] }}>
            <Pressable onPress={() => {}}>
              <SheetHandle onDismiss={close} onCancel={springBack} translateY={sheetTranslateY} />
              <ScrollView style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                {slots.map((s) => {
                  const active = s.getTime() === value.getTime();
                  return (
                    <Pressable
                      key={s.getTime()}
                      onPress={() => { onChange(s); close(); }}
                      style={{
                        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                        paddingVertical: 12, paddingHorizontal: 12, borderRadius: 9,
                        backgroundColor: active ? tokens.cyanTint10 : "transparent",
                      }}
                    >
                      <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: active ? tokens.cyan : tokens.text }}>{formatTimeWithDay(s, anchor)}</Text>
                      {active && <Check size={14} color={tokens.cyan} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/** Arrival date picker — Today/Tomorrow quick picks + a month calendar, past dates and dates beyond the advance-booking cap disabled. */
export function ArrivalDatePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(startOfMonth(value));
  const { translateY: sheetTranslateY, backdropOpacity, animateOut, springBack } = useSlideSheet(open);
  const close = () => animateOut(() => setOpen(false));

  const today = startOfDay(NOW);
  const tomorrow = new Date(today.getTime() + 86400000);
  const maxDate = new Date(today.getTime() + MAX_ADVANCE_DAYS * 86400000);
  const cells = calendarCells(calMonth);

  const pick = (d: Date) => { onChange(d); close(); };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ marginBottom: 8, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>Date</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, padding: 14 }}
      >
        <CalendarIcon size={14} color={tokens.cyan} />
        <Text style={{ fontSize: 14, color: tokens.text }}>{dateLabel(value)}</Text>
        <ChevronDown size={14} color={tokens.textSoft} style={{ marginLeft: "auto" }} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <AnimatedPressable
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(18,22,28,0.6)", opacity: backdropOpacity }}
            onPress={close}
          />
          <Animated.View style={{ backgroundColor: tokens.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, transform: [{ translateY: sheetTranslateY }] }}>
            <Pressable onPress={() => {}}>
              <SheetHandle onDismiss={close} onCancel={springBack} translateY={sheetTranslateY} />
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {[["Today", today], ["Tomorrow", tomorrow]].map(([lbl, d]) => {
                  const label = lbl as string;
                  const date = d as Date;
                  const active = isSameDate(value, date);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => pick(date)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", backgroundColor: active ? tokens.cyan : tokens.surface2 }}
                    >
                      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: active ? tokens.onAccent : tokens.text }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Pressable onPress={() => setCalMonth((m) => addMonths(m, -1))} hitSlop={8}>
                  <ChevronLeft size={16} color={tokens.textSoft} />
                </Pressable>
                <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 14, color: tokens.text }}>{monthLabel(calMonth)}</Text>
                <Pressable onPress={() => setCalMonth((m) => addMonths(m, 1))} hitSlop={8}>
                  <ChevronRight size={16} color={tokens.textSoft} />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row" }}>
                {WEEKDAY_LETTERS.map((w, i) => (
                  <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: tokens.textSoft, fontFamily: fonts.mono }}>{w}</Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {cells.map((day, i) => {
                  if (!day) return <View key={i} style={{ width: `${100 / 7}%`, height: 34 }} />;
                  const disabled = day < today || day > maxDate;
                  const active = isSameDate(day, value);
                  return (
                    <View key={i} style={{ width: `${100 / 7}%`, height: 34, alignItems: "center", justifyContent: "center" }}>
                      <Pressable
                        disabled={disabled}
                        onPress={() => pick(day)}
                        style={{
                          width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                          backgroundColor: active ? tokens.cyan : "transparent",
                        }}
                      >
                        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: disabled ? tokens.hair : active ? tokens.onAccent : tokens.text }}>
                          {day.getDate()}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
