// Decision detail — REQ-F48 / APP-037: the register's first URL-addressable
// item. `lifeos://decision/<id>` (or /decision/<id> in-app) lands on the exact
// decision with its verbs — the route a push notification about a closing veto
// window will carry. Same actions as the Home fold (shared via DecisionsFold).
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Decision = {
  id: string;
  title: string;
  proposal: string;
  kind: string;
  silence_means: string;
  closes_at: string | null;
  status: string;
  reason: string | null;
  decided_at: string | null;
};

export default function DecisionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Decision | null | "missing">(null);

  useEffect(() => {
    logEvent("item_opened", { source_view: "decision-detail", item_type: "decision", item_id: String(id) });
    supabase
      .from("decisions")
      .select("id,title,proposal,kind,silence_means,closes_at,status,reason,decided_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setD((data as Decision) ?? "missing"));
  }, [id]);

  async function act(status: "approved" | "vetoed" | "deferred", extra: Record<string, unknown> = {}) {
    if (!d || d === "missing") return;
    logEvent(`decision_${status}`, { source_view: "decision-detail", item_type: "decision", item_id: d.id });
    await supabase.from("decisions").update({ status, decided_at: new Date().toISOString(), ...extra }).eq("id", d.id);
    router.back();
  }

  if (d === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (d === "missing") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 15, color: colors.textSecondary, textAlign: "center" }}>
          That decision isn't here — it may belong to another account.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xl * 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.goldBright }}>{d.title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, marginTop: spacing.sm }}>{d.proposal}</Text>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textMuted, marginTop: spacing.sm }}>
        Silence: {d.silence_means}
        {d.closes_at ? ` · closes ${d.closes_at}` : ""}
      </Text>

      {d.status === "pending" ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <TouchableOpacity onPress={() => act("approved")} style={{ flex: 1, backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.prompt?.("Veto — why?", "One line is enough.", (reason) => act("vetoed", { reason: reason || null })) ??
              act("vetoed")
            }
            style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}
          >
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.danger }}>Veto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft, marginTop: spacing.lg }}>
          {d.status}
          {d.decided_at ? ` · ${d.decided_at.slice(0, 10)}` : ""}
          {d.reason ? ` — ${d.reason}` : ""}
        </Text>
      )}
    </View>
  );
}
