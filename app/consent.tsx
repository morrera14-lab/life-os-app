// Consent screen — REQ-F68 (APP-021): no main screen is reachable until the
// two required consents are granted. Shown by the root layout's gate for any
// signed-in user without a granted privacy_policy + data_processing row.
//
// The notice text below IS the policy the user consents to (POLICY_VERSION
// stamps every ledger row with what they saw — GDPR Art. 7(1)). Analytics is
// genuinely optional: declining it writes an explicit granted=false row and
// never blocks the button.
import { useState } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export const POLICY_VERSION = "2026-09-18";
export const consentFlagKey = (userId: string) => `consent_ok_${userId}_${POLICY_VERSION}`;

const NOTICE = [
  {
    title: "What we store",
    body: "Your captures, tasks, notes, habits, and app activity are stored in your own account on Supabase (our database provider). Only you can read your rows — enforced at the database layer, not just in the app.",
  },
  {
    title: "How your text is processed",
    body: "When you capture a thought, its text is sent to Anthropic's Claude API to be sorted into the right place. Crash reports (no personal content) go to Sentry so we can fix failures.",
  },
  {
    title: "What we never do",
    body: "No ads, no selling or sharing your data with anyone else, no tracking outside the app.",
  },
  {
    title: "Your rights",
    body: "You can delete your account and every piece of your data at any time from Settings — it takes effect immediately and is not reversible by us or anyone.",
  },
];

export default function Consent() {
  const router = useRouter();
  const [privacyOk, setPrivacyOk] = useState(false);
  const [processingOk, setProcessingOk] = useState(false);
  const [analyticsOk, setAnalyticsOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const canContinue = privacyOk && processingOk && !saving;

  const submit = async () => {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }
    const rows = [
      { user_id: userId, consent_key: "privacy_policy", granted: true, policy_version: POLICY_VERSION },
      { user_id: userId, consent_key: "data_processing", granted: true, policy_version: POLICY_VERSION },
      { user_id: userId, consent_key: "analytics", granted: analyticsOk, policy_version: POLICY_VERSION },
    ];
    const { error } = await supabase.from("consents").insert(rows);
    if (error) {
      setSaving(false);
      Alert.alert("Couldn't save", "Your consent couldn't be recorded. Check your connection and try again.");
      return;
    }
    try {
      await AsyncStorage.setItem(consentFlagKey(userId), "1");
    } catch {
      // cache only — the gate re-queries when the flag is missing
    }
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl * 2 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.goldBright, marginBottom: spacing.sm }}>
          Your data, your call
        </Text>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.lg }}>
          Before anything else — here is exactly what this app does with your data, and your say over it.
        </Text>

        {NOTICE.map((s) => (
          <View key={s.title} style={{ marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.gold, marginBottom: 2 }}>{s.title}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 }}>{s.body}</Text>
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: colors.goldDeep, marginVertical: spacing.md }} />

        <ConsentRow
          label="I accept the privacy notice above"
          required
          value={privacyOk}
          onChange={setPrivacyOk}
        />
        <ConsentRow
          label="I consent to my captures being processed as described"
          required
          value={processingOk}
          onChange={setProcessingOk}
        />
        <ConsentRow
          label="Anonymous usage analytics to improve the app (optional)"
          value={analyticsOk}
          onChange={setAnalyticsOk}
        />

        <TouchableOpacity
          disabled={!canContinue}
          onPress={submit}
          style={{
            backgroundColor: canContinue ? colors.gold : colors.surfaceRaised,
            borderRadius: radii.md,
            padding: spacing.md,
            alignItems: "center",
            marginTop: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: canContinue ? colors.bg : colors.textMuted }}>
              Agree & continue
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ConsentRow({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, marginRight: spacing.md }}>
        {label}
        {required ? <Text style={{ color: colors.goldMuted }}>  · required</Text> : null}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceRaised, true: colors.goldDeep }}
        thumbColor={value ? colors.gold : colors.textMuted}
      />
    </View>
  );
}
