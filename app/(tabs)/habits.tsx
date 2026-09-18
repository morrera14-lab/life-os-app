// Habits — arriving with the Sep build; until then the empty state GUIDES
// (UI pattern #1, APP-044): a visual + one clear action, never a bare stub line.
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export default function Habits() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
      <Text style={{ fontSize: 34 }}>🌱</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.goldBright, marginTop: spacing.sm }}>
        Habits take root here soon
      </Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" }}>
        The tracker arrives with the Sep build. A habit you want to start is worth capturing now.
      </Text>
      <TouchableOpacity onPress={() => router.push("/capture")} style={{ marginTop: spacing.md, borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold }}>Capture a habit idea</Text>
      </TouchableOpacity>
    </View>
  );
}
