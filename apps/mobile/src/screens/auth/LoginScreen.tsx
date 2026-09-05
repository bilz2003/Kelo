import React, { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { BrandMark } from "@/components/Controls";
import { PrimaryButton } from "@/components/Button";
import { useAuth } from "@/state/AuthContext";

export function LoginScreen({ onNavigateToRegister }: { onNavigateToRegister: () => void }) {
  const { tokens } = useTheme();
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch {
      // error already surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // iOS: "padding" is still correct here — Android is handled by the OS
    // itself via windowSoftInputMode "pan" (see app.json), which shifts the
    // whole window instead of asking RN to resize/relayout, so no `behavior`
    // is needed here on that platform.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.ink }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
         * Deliberately NOT vertically centered (no justifyContent: "center").
         * Centering ties every field's on-screen position to the container's
         * available height, which changes whenever the keyboard frame does —
         * see the KeyboardAvoidingView note below. Top-anchoring makes field
         * position independent of keyboard height entirely.
         */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <BrandMark size={34} textSize={26} gap={10} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: tokens.cyan, letterSpacing: 0.2, marginTop: 10 }}>verified, metered charging</Text>
        </View>

        <Text style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 22, color: tokens.text, marginBottom: 6, letterSpacing: -0.3 }}>
          Welcome back
        </Text>
        <Text style={{ fontSize: 13, color: tokens.textSoft, lineHeight: 19, marginBottom: 28 }}>
          Log in to book chargers or manage the ones you host.
        </Text>

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          Email
        </Text>
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
          style={{
            backgroundColor: tokens.surface2,
            borderWidth: 1,
            borderColor: tokens.hair,
            borderRadius: radii.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 13.5,
            color: tokens.text,
            marginBottom: 16,
          }}
        />

        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.textSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) clearError();
          }}
          placeholder="••••••••"
          placeholderTextColor={tokens.textSoft}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={submit}
          style={{
            backgroundColor: tokens.surface2,
            borderWidth: 1,
            borderColor: tokens.hair,
            borderRadius: radii.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 13.5,
            color: tokens.text,
            marginBottom: 10,
          }}
        />

        {/*
         * Fixed-height slot, always rendered, regardless of whether `error`
         * is set. Conditionally rendering this block (and varying the
         * password field's marginBottom above) reflows everything below it
         * — the button and the "create an account" link jump — every time
         * an error appears or clears. Reserving the space up front removes
         * that jump entirely.
         */}
        <View style={{ minHeight: 32, marginBottom: 14 }}>
          {error && <Text style={{ fontSize: 12.5, color: tokens.danger, lineHeight: 18 }}>{error}</Text>}
        </View>

        <PrimaryButton onPress={submit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={tokens.onAccent} /> : "Log in"}
        </PrimaryButton>

        <Pressable onPress={onNavigateToRegister} style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: tokens.textSoft }}>
            New to Kelo? <Text style={{ color: tokens.cyan, fontFamily: fonts.bodyMedium }}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
