import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";

interface CurrencyFieldProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min: number;
  max: number;
  unit?: string;
  helper?: string;
  placeholder?: string;
  optional?: boolean;
}

/**
 * A required field can never end up committed as an empty/invalid value —
 * this was a real bug caught in the web prototype (a cleared rate field
 * briefly became "" and crashed `.toFixed()` elsewhere in the app). The
 * fix here is the same one used there: keep a local draft string while
 * typing, and only call onChange with a validated, clamped number (or
 * undefined, for optional fields) once the field loses focus.
 */
export function CurrencyField({ label, value, onChange, min, max, unit = "kWh", helper, placeholder, optional = false }: CurrencyFieldProps) {
  const { tokens } = useTheme();
  const toStr = (v: number | undefined) => (v === undefined ? "" : String(v));
  const [draft, setDraft] = useState(toStr(value));

  useEffect(() => setDraft(toStr(value)), [value]);

  const commit = () => {
    if (draft.trim() === "") {
      if (optional) {
        onChange(undefined);
      } else {
        setDraft(toStr(value)); // required field left blank — revert, don't propagate
      }
      return;
    }
    const n = parseFloat(draft);
    if (isNaN(n)) {
      setDraft(toStr(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    const fixed = parseFloat(clamped.toFixed(2));
    setDraft(String(fixed));
    onChange(fixed);
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ marginBottom: 8, fontSize: 10.5, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: fonts.mono }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: tokens.surface2,
          borderWidth: 1,
          borderColor: tokens.hair,
          borderRadius: radii.md,
          paddingHorizontal: 14,
          paddingVertical: 11,
        }}
      >
        <Text style={{ fontFamily: fonts.mono, color: tokens.textSoft, fontSize: 14 }}>£</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={tokens.textSoft}
          style={{ flex: 1, fontFamily: fonts.mono, fontSize: 15, color: tokens.text, padding: 0 }}
        />
        <Text style={{ fontFamily: fonts.mono, color: tokens.textSoft, fontSize: 12 }}>/ {unit}</Text>
      </View>
      {helper && <Text style={{ marginTop: 6, fontSize: 11.5, color: tokens.textSoft, lineHeight: 16 }}>{helper}</Text>}
    </View>
  );
}
