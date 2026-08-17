// Universal Capture — STUB (REQ-F03/F04). Routing via Claude lands Sep 15
// (route_capture Edge Function; prompt spec in vault AI_MANAGEMENT.md §1.2).
import { View, Text } from "react-native";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Capture() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.goldBright, textAlign: "center" }}>
        Capture
      </Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 16, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md }}>
        Stub — say it all, it gets sorted. Claude routing arrives with the Sep build.
      </Text>
    </View>
  );
}
