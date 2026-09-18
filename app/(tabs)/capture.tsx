// Universal Capture — REQ-F03/F04, US-03. The full-screen home of capture;
// the mechanics live in components/CaptureBar.tsx (APP-009) so the exact same
// routing flow also renders as the compact bar on Home. One flow, two skins.
import { View, Text } from "react-native";
import { CaptureBar } from "@/components/CaptureBar";
import { colors, fonts, spacing } from "@/lib/theme";

export default function Capture() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md }}>
        Say it all — it gets sorted.
      </Text>
      <CaptureBar sourceView="capture" />
    </View>
  );
}
