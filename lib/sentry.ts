// Sentry — copied from the Faith Apps pattern (@sentry/react-native, NOT the deprecated
// sentry-expo; see faith-apps DEPLOYMENT.md §8). Init is guarded: no DSN = silent no-op,
// so dev/preview builds run without a Sentry project existing yet.
//
// REQ-F27: automatic crash capture + post-crash user prompt. checkCrashAndPrompt() is
// called once at app start (app/_layout.tsx) — if the previous run crashed, the user is
// asked whether to send context, which attaches as user feedback to the crash event.
import * as Sentry from "@sentry/react-native";
import { Alert } from "react-native";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    enabled: Boolean(DSN),
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // matches Faith Apps' App Privacy answers: crash data not linked to identity
  });
}

export async function checkCrashAndPrompt() {
  if (!DSN) return;
  try {
    const crashed = await Sentry.crashedLastRun();
    if (!crashed) return;
    Alert.alert(
      "Life OS closed unexpectedly",
      "A crash report was captured. Send it to help us fix the problem?",
      [
        { text: "Don't send", style: "cancel" },
        {
          text: "Send report",
          onPress: () => {
            // Crash event itself was already captured natively; this adds the user's consent marker.
            Sentry.captureMessage("post-crash report consented", "info");
          },
        },
      ],
    );
  } catch {
    // never let crash-reporting break app start
  }
}

export { Sentry };
