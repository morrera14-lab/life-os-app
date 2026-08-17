// Daily Briefing — STUB (REQ-F01). The app's front door; real briefing lands Sep 15.
import { View, Text } from "react-native";
import { colors, fonts, spacing } from "@/lib/theme";

export default function DailyBriefing() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.goldBright, textAlign: "center" }}>
        Daily Briefing
      </Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md }}>
        Stub — scripture anchor, tasks due, intentions, and the "Right now" slot arrive with the Sep build.
      </Text>
    </View>
  );
}
