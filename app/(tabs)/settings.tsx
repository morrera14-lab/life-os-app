// Settings — auth sign-out + feedback entry point (REQ-F28 live from day one)
// + Privacy & data (APP-021): analytics consent toggle (REQ-F69 — a change is a
// NEW ledger row, never an edit) and the REQ-F70 delete-my-data path.
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Switch, Alert, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { FeedbackModal } from "@/components/FeedbackModal";
import { colors, fonts, spacing, radii } from "@/lib/theme";
import { POLICY_VERSION, consentFlagKey } from "../consent";

export default function Settings() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [analyticsOk, setAnalyticsOk] = useState<boolean | null>(null); // null = loading
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("consents")
        .select("granted")
        .eq("consent_key", "analytics")
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled) setAnalyticsOk(data?.[0]?.granted ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAnalytics = async (value: boolean) => {
    const previous = analyticsOk;
    setAnalyticsOk(value); // optimistic — reverted on failure
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("consents").insert({
      user_id: userId,
      consent_key: "analytics",
      granted: value,
      policy_version: POLICY_VERSION,
    });
    if (error) {
      setAnalyticsOk(previous);
      Alert.alert("Couldn't save", "Your preference couldn't be recorded. Check your connection and try again.");
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently erases your account and ALL your data — captures, tasks, notes, habits, history, everything. It cannot be undone by anyone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert("Last check", "Delete everything, permanently?", [
              { text: "Keep my account", style: "cancel" },
              { text: "Delete everything", style: "destructive", onPress: deleteAccount },
            ]),
        },
      ],
    );
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    const { error } = await supabase.functions.invoke("delete_account", { method: "POST" });
    if (error) {
      setDeleting(false);
      Alert.alert("Delete failed", "Your data was NOT deleted. Check your connection and try again.");
      return;
    }
    if (userId) {
      try {
        await AsyncStorage.removeItem(consentFlagKey(userId));
      } catch {
        // flag is per-user; a stale one can't unlock anyone else
      }
    }
    await supabase.auth.signOut(); // auth gate routes to sign-in
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
      <TouchableOpacity
        onPress={() => setFeedbackOpen(true)}
        style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.text }}>💬 Send feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => supabase.auth.signOut()}
        style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.danger }}>Sign out</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Privacy & data
      </Text>

      <View
        style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md }}
      >
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, marginRight: spacing.md }}>
          Anonymous usage analytics
        </Text>
        {analyticsOk === null ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <Switch
            value={analyticsOk}
            onValueChange={setAnalytics}
            trackColor={{ false: colors.surfaceRaised, true: colors.goldDeep }}
            thumbColor={analyticsOk ? colors.gold : colors.textMuted}
          />
        )}
      </View>

      <TouchableOpacity
        onPress={confirmDelete}
        disabled={deleting}
        style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger, padding: spacing.md }}
      >
        {deleting ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.danger }}>Delete my account & data</Text>
        )}
      </TouchableOpacity>

      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textMuted, marginTop: spacing.lg }}>
        Briefing time, intentions, and check-in preferences arrive with the Sep build.
      </Text>

      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}
