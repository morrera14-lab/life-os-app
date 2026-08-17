// Settings — auth sign-out + feedback entry point (REQ-F28 live from day one).
import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { FeedbackModal } from "@/components/FeedbackModal";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export default function Settings() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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

      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textMuted, marginTop: spacing.lg }}>
        Briefing time, intentions, and check-in preferences arrive with the Sep build.
      </Text>

      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}
