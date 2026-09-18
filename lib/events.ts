// REQ-F54 — the append-only interaction log's write helper. Fire-and-forget
// by design: logging must never block or slow the interaction it records, so
// callers never await this and every failure is swallowed.
import { supabase } from "./supabase";

export function logEvent(
  event_type: string,
  opts: {
    source_view?: string;
    item_type?: string;
    item_id?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      await supabase.from("events").insert({ user_id: uid, event_type, ...opts });
    } catch {
      // never surface — the log is telemetry, not UX
    }
  })();
}
