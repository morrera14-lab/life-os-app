// Root layout — fonts, Sentry, auth gate.
// Pattern: Expo Router per ARCHITECTURE.md ("navigation pattern (Expo Router)");
// font loading copied from WordApp-Expo/App.js.
import "react-native-url-polyfill/auto"; // MUST be first import (supabase-js requirement)
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Cinzel_700Bold,
} from "@expo-google-fonts/cinzel";
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
} from "@expo-google-fonts/eb-garamond";
import type { Session } from "@supabase/supabase-js";

import { initSentry, checkCrashAndPrompt, Sentry } from "@/lib/sentry";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

initSentry();

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    checkCrashAndPrompt(); // REQ-F27 post-crash prompt

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const inAuthScreen = segments[0] === "sign-in";
    if (!session && !inAuthScreen) router.replace("/sign-in");
    if (session && inAuthScreen) router.replace("/");
  }, [session, authReady, segments]);

  if (!fontsLoaded || !authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}

export default Sentry.wrap(RootLayout);
