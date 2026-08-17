// Auth screen — email/password against the life-os-app Supabase project.
// Signup trigger seeds Faith/Health/Career domains + profile row server-side
// (see vault migrations 01_profiles_and_domains.sql).
// Apple Sign-In (REQ-F07, App Store requirement) is a Sep build task — needs native config.
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "in" | "up") {
    if (!supabaseConfigured) {
      Alert.alert("Not configured", "Supabase env vars are missing — check .env.");
      return;
    }
    setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) Alert.alert("Sign-in failed", error.message);
    // success: onAuthStateChange in _layout redirects
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: 34, color: colors.goldBright, textAlign: "center" }}>
        Life OS
      </Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl }}>
        Your day, delivered.
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={inputStyle}
      />

      <TouchableOpacity disabled={busy} onPress={() => submit("in")} style={btnPrimary}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 18, color: colors.bg }}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={() => submit("up")} style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 16, color: colors.goldSoft }}>
          New here? Create an account
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  fontFamily: fonts.body,
  fontSize: 17,
  color: colors.text,
  backgroundColor: colors.surface,
  borderColor: colors.goldDeep,
  borderWidth: 1,
  borderRadius: radii.md,
  padding: spacing.md,
  marginBottom: spacing.md,
} as const;

const btnPrimary = {
  backgroundColor: colors.gold,
  borderRadius: radii.md,
  padding: spacing.md,
  alignItems: "center" as const,
  marginTop: spacing.sm,
};
