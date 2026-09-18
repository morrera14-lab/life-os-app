// Root layout — fonts, Sentry, auth gate, consent gate (REQ-F68).
// Pattern: Expo Router per ARCHITECTURE.md ("navigation pattern (Expo Router)");
// font loading copied from WordApp-Expo/App.js.
// Consent gate is FAIL-CLOSED: until a granted privacy_policy + data_processing
// pair is verified (device flag, else the consents ledger), main screens are
// unreachable. The flag is per-user AND per-policy-version, so a new policy
// version re-gates everyone exactly once.
import "react-native-url-polyfill/auto"; // MUST be first import (supabase-js requirement)
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { POLICY_VERSION, consentFlagKey } from "./consent";

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
  const [consentStatus, setConsentStatus] = useState<"unknown" | "ok" | "needed">("unknown");
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

  // Consent check — device flag first (ms, offline-safe), ledger query only
  // when the flag is absent (first launch on this device / new policy version).
  useEffect(() => {
    if (!session) {
      setConsentStatus("unknown");
      return;
    }
    let cancelled = false;
    const uid = session.user.id;
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(consentFlagKey(uid));
        if (flag === "1") {
          if (!cancelled) setConsentStatus("ok");
          return;
        }
      } catch {
        // fall through to the ledger query
      }
      const { data } = await supabase
        .from("consents")
        .select("consent_key, granted, created_at")
        .in("consent_key", ["privacy_policy", "data_processing"])
        .eq("policy_version", POLICY_VERSION)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const latest: Record<string, boolean> = {};
      for (const row of data ?? []) {
        if (!(row.consent_key in latest)) latest[row.consent_key] = row.granted;
      }
      const ok = latest["privacy_policy"] === true && latest["data_processing"] === true;
      if (ok) {
        try {
          await AsyncStorage.setItem(consentFlagKey(uid), "1");
        } catch {
          // cache only
        }
      }
      setConsentStatus(ok ? "ok" : "needed"); // query failure gates too — fail-closed
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!authReady) return;
    const seg = segments[0] as string | undefined;
    if (!session && seg !== "sign-in") {
      router.replace("/sign-in");
      return;
    }
    if (session && seg === "sign-in") {
      router.replace("/");
      return;
    }
    if (session && consentStatus === "needed" && seg !== "consent") {
      // Re-read the flag before bouncing — consent.tsx sets it just before
      // routing home, ahead of this state catching up.
      AsyncStorage.getItem(consentFlagKey(session.user.id))
        .then((f) => {
          if (f === "1") setConsentStatus("ok");
          else router.replace("/consent");
        })
        .catch(() => router.replace("/consent"));
    }
    if (session && consentStatus === "ok" && seg === "consent") router.replace("/");
  }, [session, authReady, segments, consentStatus]);

  if (!fontsLoaded || !authReady || (session && consentStatus === "unknown")) {
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
