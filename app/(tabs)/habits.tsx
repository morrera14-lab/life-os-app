// Habit Tracker — STUB (REQ-F16–F19). Weekly grid with Daily/Devotional sections
// and rest-day grace (REQ-F37) lands Sep 15; schema already live (habits/habit_completions).
import { View, Text } from "react-native";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Habits() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.goldBright, textAlign: "center" }}>
        Habits
      </Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md }}>
        Stub — the weekly grid (Daily + Devotional) arrives with the Sep build.
      </Text>
    </View>
  );
}
