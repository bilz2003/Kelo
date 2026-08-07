import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Animated } from "react-native";
import { Calendar, ChevronDown, Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { SheetHandle } from "@/components/SheetHandle";
import { useSlideSheet } from "@/components/useSlideSheet";
import { TimeRangeValue } from "@/types";
import {
  NOW, monthKey, monthLabel, startOfMonth, endOfMonth, addMonths, calendarCells,
  isSameDate, formatRangeLabel, WEEKDAY_LETTERS,
} from "@/utils/dateTime";

const TODAY = NOW;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Compact button that expands into a bottom sheet with either a scrollable
 * month list or a real calendar for a custom start/end range, plus an
 * "All time" shortcut. Shared by Bookings and My Chargers' stats section.
 */
export function TimeFilterButton({ value, onChange }: { value: TimeRangeValue; onChange: (v: TimeRangeValue) => void }) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"month" | "range">(value.mode === "range" ? "range" : "month");
  const [calMonth, setCalMonth] = useState(value.mode === "range" ? startOfMonth(value.start) : startOfMonth(TODAY));
  const [draftStart, setDraftStart] = useState<Date | null>(value.mode === "range" ? value.start : null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value.mode === "range" ? value.end : null);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const { translateY: sheetTranslateY, backdropOpacity, animateOut, springBack } = useSlideSheet(open);

  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(TODAY), -i));
  const years = Array.from({ length: 11 }, (_, i) => TODAY.getFullYear() - 10 + i);
  const cells = calendarCells(calMonth);

  // Every dismiss path (backdrop tap, swipe-to-dismiss, and picking a
  // month/range/all-time) funnels through this one function, so all of
  // them animate out the same way rather than some sliding and some
  // popping instantly.
  const close = () => {
    animateOut(() => {
      setOpen(false);
      setYearPickerOpen(false);
    });
  };

  const pickMonth = (m: Date) => {
    onChange({ mode: "month", start: startOfMonth(m), end: endOfMonth(m), label: monthLabel(m) });
    close();
  };

  const pickAllTime = () => {
    onChange({ mode: "all", start: new Date(2000, 0, 1), end: new Date(2100, 0, 1), label: "All time" });
    close();
  };

  const pickYear = (y: number) => {
    setCalMonth((m) => new Date(y, m.getMonth(), 1));
    setYearPickerOpen(false);
  };

  const pickDay = (day: Date) => {
    if (!draftStart || draftEnd) {
      setDraftStart(day);
      setDraftEnd(null);
    } else if (day < draftStart) {
      setDraftStart(day);
      setDraftEnd(null);
    } else {
      setDraftEnd(day);
    }
  };

  const applyRange = () => {
    if (!draftStart) return;
    const start = draftStart;
    const end = draftEnd || draftStart;
    onChange({ mode: "range", start, end, label: formatRangeLabel(start, end) });
    close();
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.hair, borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: 14 }}
      >
        <Calendar size={14} color={tokens.cyan} />
        <Text style={{ fontSize: 13, fontWeight: "500", color: tokens.text }}>{value.label}</Text>
        <ChevronDown size={14} color={tokens.textSoft} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <AnimatedPressable
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(18,22,28,0.6)", opacity: backdropOpacity }}
            onPress={close}
          />
          <Animated.View style={{ backgroundColor: tokens.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, maxHeight: "80%", transform: [{ translateY: sheetTranslateY }] }}>
            <Pressable onPress={() => {}}>
              <SheetHandle onDismiss={close} onCancel={springBack} translateY={sheetTranslateY} />
              <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 20 }}>
                <Pressable
                  onPress={pickAllTime}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 11, paddingHorizontal: 12, borderRadius: radii.md, marginBottom: 12,
                    backgroundColor: value.mode === "all" ? tokens.cyanTint10 : tokens.surface2,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13.5, color: value.mode === "all" ? tokens.cyan : tokens.text }}>All time</Text>
                  {value.mode === "all" && <Check size={14} color={tokens.cyan} />}
                </Pressable>

                <View style={{ flexDirection: "row", gap: 4, backgroundColor: tokens.surface2, borderRadius: radii.md, padding: 4, marginBottom: 14 }}>
                  {(["month", "range"] as const).map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => setTab(key)}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tab === key ? tokens.cyan : "transparent" }}
                    >
                      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: tab === key ? tokens.onAccent : tokens.textSoft }}>
                        {key === "month" ? "Month" : "Custom range"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {tab === "month" ? (
                  <View>
                    {months.map((m) => {
                      const active = value.mode === "month" && monthKey(value.start) === monthKey(m);
                      return (
                        <Pressable
                          key={monthKey(m)}
                          onPress={() => pickMonth(m)}
                          style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                            paddingVertical: 11, paddingHorizontal: 12, borderRadius: radii.md, marginBottom: 2,
                            backgroundColor: active ? tokens.cyanTint10 : "transparent",
                          }}
                        >
                          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: active ? tokens.cyan : tokens.text }}>{monthLabel(m)}</Text>
                          {active && <Check size={14} color={tokens.cyan} />}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <Pressable onPress={() => setCalMonth((m) => addMonths(m, -1))} hitSlop={8} style={{ opacity: yearPickerOpen ? 0 : 1 }} disabled={yearPickerOpen}>
                        <ChevronLeft size={16} color={tokens.textSoft} />
                      </Pressable>
                      <Pressable onPress={() => setYearPickerOpen((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 14, color: tokens.text }}>
                          {yearPickerOpen ? "Choose a year" : monthLabel(calMonth)}
                        </Text>
                        {!yearPickerOpen && <ChevronDown size={12} color={tokens.textSoft} />}
                      </Pressable>
                      <Pressable onPress={() => setCalMonth((m) => addMonths(m, 1))} hitSlop={8} style={{ opacity: yearPickerOpen ? 0 : 1 }} disabled={yearPickerOpen}>
                        <ChevronRight size={16} color={tokens.textSoft} />
                      </Pressable>
                    </View>

                    {yearPickerOpen ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                        {years.map((y) => {
                          const active = y === calMonth.getFullYear();
                          return (
                            <Pressable
                              key={y}
                              onPress={() => pickYear(y)}
                              style={{
                                width: "31%", paddingVertical: 12, borderRadius: radii.md, alignItems: "center",
                                backgroundColor: active ? tokens.cyan : tokens.surface2,
                              }}
                            >
                              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: active ? tokens.onAccent : tokens.text }}>{y}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: "row", marginBottom: 4 }}>
                          {WEEKDAY_LETTERS.map((w, i) => (
                            <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: tokens.textSoft, fontFamily: fonts.mono }}>{w}</Text>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                          {cells.map((day, i) => {
                            if (!day) return <View key={i} style={{ width: `${100 / 7}%`, height: 30 }} />;
                            const isStart = !!draftStart && isSameDate(day, draftStart);
                            const isEnd = !!draftEnd && isSameDate(day, draftEnd);
                            const inRange = !!draftStart && !!draftEnd && day > draftStart && day < draftEnd;
                            const today = isSameDate(day, TODAY);
                            return (
                              <View key={i} style={{ width: `${100 / 7}%`, height: 30, alignItems: "center", justifyContent: "center" }}>
                                <Pressable
                                  onPress={() => pickDay(day)}
                                  style={{
                                    width: 28, height: 28, alignItems: "center", justifyContent: "center",
                                    borderWidth: today && !isStart && !isEnd ? 1 : 0,
                                    borderColor: tokens.cyanTint30,
                                    borderRadius: isStart || isEnd ? 14 : inRange ? 4 : 14,
                                    backgroundColor: isStart || isEnd ? tokens.cyan : inRange ? tokens.cyanTint10 : "transparent",
                                  }}
                                >
                                  <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: isStart || isEnd ? tokens.onAccent : tokens.text }}>{day.getDate()}</Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>

                        <Pressable
                          onPress={applyRange}
                          disabled={!draftStart}
                          style={{ paddingVertical: 11, paddingHorizontal: 16, borderRadius: radii.lg, alignItems: "center", backgroundColor: draftStart ? tokens.cyan : tokens.hair }}
                        >
                          <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 13.5, color: draftStart ? tokens.onAccent : tokens.textSoft }}>
                            {draftStart && !draftEnd ? "Apply single day" : "Apply range"}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
