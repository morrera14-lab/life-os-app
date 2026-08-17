// REQ-F28 — in-app feedback form → Supabase `feedback` table (FEEDBACK_SYSTEM.md §2).
// Working from day one: type picker (Broken / Idea / Confusing), description, writes
// user_id + app_version + device. Screenshot attachment is a Sep build addition.
// RLS: insert allowed only for the authenticated user's own row, source in form/crash/error.
import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert, Platform,
} from "react-native";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { colors, fonts, spacing, radii } from "@/lib/theme";

const TYPES = [
  { key: "bug", label: "🐞 Something's broken" },
  { key: "idea", label: "💡 Idea" },
  { key: "confusing", label: "😕 Confusing" },
] as const;

export function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("bug");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!description.trim()) return;
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert({
      user_id: userData.user?.id,
      type,
      source: "form",
      description: description.trim(),
      app_version: Constants.expoConfig?.version ?? "unknown",
      device: `${Platform.OS} ${Platform.Version}`,
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't send", error.message);
      return;
    }
    setDescription("");
    onClose();
    Alert.alert("Thank you", "Your feedback is in the queue.");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.goldBright, marginBottom: spacing.md }}>
            Send feedback
          </Text>

          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setType(t.key)}
              style={{
                padding: spacing.sm,
                borderRadius: radii.sm,
                marginBottom: spacing.xs,
                backgroundColor: type === t.key ? colors.surfaceRaised : "transparent",
                borderWidth: 1,
                borderColor: type === t.key ? colors.gold : "transparent",
              }}
            >
              <Text style={{ fontFamily: fonts.body, fontSize: 16, color: colors.text }}>{t.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            placeholder="What happened, or what would help?"
            placeholderTextColor={colors.textMuted}
            multiline
            value={description}
            onChangeText={setDescription}
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              color: colors.text,
              backgroundColor: colors.bg,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.goldDeep,
              padding: spacing.md,
              minHeight: 90,
              marginVertical: spacing.md,
              textAlignVertical: "top",
            }}
          />

          <TouchableOpacity
            disabled={busy || !description.trim()}
            onPress={send}
            style={{ backgroundColor: colors.gold, borderRadius: radii.md, padding: spacing.md, alignItems: "center", opacity: description.trim() ? 1 : 0.5 }}
          >
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.bg }}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ padding: spacing.md, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
