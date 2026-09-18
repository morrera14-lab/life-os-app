// Bottom tab navigation — the five MVP surfaces (stubs; logic lands Sep 15).
import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors, fonts } from "@/lib/theme";

// SDK 57's tabBarIcon type widened `color` from `string` to `ColorValue`
// (it can be an OpaqueColorValue on some platforms) — accept that, cast to
// string only where the style prop actually needs it.
function icon(glyph: string) {
  return ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color: color as string }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: fonts.display, color: colors.goldBright, fontSize: 20 },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.goldDeep },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icon("☀") }} />
      <Tabs.Screen name="capture" options={{ title: "Capture", tabBarIcon: icon("✎") }} />
      <Tabs.Screen name="domains" options={{ title: "Domains", tabBarIcon: icon("◈") }} />
      <Tabs.Screen name="habits" options={{ title: "Habits", tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("⚙") }} />
    </Tabs>
  );
}
