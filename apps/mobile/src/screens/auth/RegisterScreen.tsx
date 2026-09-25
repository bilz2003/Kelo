import React, { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PrimaryButton } from "@/components/Button";
import { useAuth } from "@/state/AuthContext";

export function RegisterScreen({ onBack }: { onBack: () => void }) {
  const { tokens } = useTheme();
  const { register, error, clearError } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0 && password.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password, firstName.trim(), lastName.trim());
    } catch {
      // error already surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: tokens.surface2,
    borderWidth: 1,
    borderColor: tokens.hair,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    color: tokens.text,
    marginBottom: 16,
  };

  const label = { fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8 };

  return (
    // See LoginScreen for why Android gets no `behavior` here: windowSoftInputMode
    // "pan" (app.json) handles it natively instead.
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.ink, paddingTop: 54 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Create account" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 13, color: tokens.textSoft, lineHeight: 19, marginBottom: 24 }}>
          One account for booking chargers and hosting your own — no separate driver/host signup.
        </Text>

        <Text style={label}>First name</Text>
        <TextInput
          value={firstName}
          onChangeText={(v) => {
            setFirstName(v);
            if (error) clearError();
          }}
          placeholder="First name"
          placeholderTextColor={tokens.textSoft}
          textContentType="givenName"
          maxLength={50}
          style={inputStyle}
        />

        <Text style={label}>Last name</Text>
        <TextInput
          value={lastName}
          onChangeText={(v) => {
            setLastName(v);
            if (error) clearError();
          }}
          placeholder="Last name"
          placeholderTextColor={tokens.textSoft}
          textContentType="familyName"
          maxLength={50}
          style={inputStyle}
        />

        <Text style={label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) clearError();
          }}
          placeholder="you@example.com"
          placeholderTextColor={tokens.textSoft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />

        <Text style={label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) clearError();
          }}
          placeholder="At least 8 characters, one letter and one number"
          placeholderTextColor={tokens.textSoft}
          secureTextEntry
          textContentType="newPassword"
          onSubmitEditing={submit}
          style={[inputStyle, { marginBottom: 10 }]}
        />

        {/* Fixed-height slot — see LoginScreen for why this can't be conditionally rendered. */}
        <View style={{ minHeight: 32, marginBottom: 14 }}>
          {error && <Text style={{ fontSize: 12.5, color: tokens.danger, lineHeight: 18 }}>{error}</Text>}
        </View>

        <PrimaryButton onPress={submit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={tokens.onAccent} /> : "Create account"}
        </PrimaryButton>

        <Pressable onPress={onBack} style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: tokens.textSoft }}>
            Already have an account? <Text style={{ color: tokens.cyan, fontFamily: fonts.bodyMedium }}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
