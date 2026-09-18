// Decisions register fold — REQ-F46 / APP-035 (native mirror of LOC-132,
// single-user per the APP-028 transplant rule). Renders NOTHING when no
// decision is pending — the fold earns its place on Home only when the user
// is actually awaited. Approve / Veto / Defer write back to the register and
// to the events log (decision_approved/vetoed/deferred — REQ-F54 starter set).
//
// Producer note (honest): nothing in the native app WRITES decisions yet —
// the briefing generator and Silent Listener (REQ-F66/F67) are the named
// producers when they land. The register, actions, and this surface are the
// contract they write into.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
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
};

export function DecisionsFold() {
  const router = useRouter();
  const [pending, setPending] = useState<Decision[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("decisions")
      .select("id,title,proposal,kind,silence_means,closes_at")
      .eq("status", "pending")
      .order("closes_at", { ascending: true, nullsFirst: false });
    setPending((data ?? []) as Decision[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(d: Decision, status: "approved" | "vetoed" | "deferred", extra: Record<string, unknown> = {}) {
    setPending((p) => p.filter((x) => x.id !== d.id));
    logEvent(`decision_${status}`, { source_view: "home", item_type: "decision", item_id: d.id });
    await supabase
      .from("decisions")
      .update({ status, decided_at: new Date().toISOString(), ...extra })
      .eq("id", d.id);
  }

  const veto = (d: Decision) =>
    Alert.prompt?.(
      "Veto — why?",
      "One line is enough; the reason is the record.",
      (reason) => act(d, "vetoed", { reason: reason || null }),
    ) ?? act(d, "vetoed");

  const defer = (d: Decision) => {
    const dt = new Date(Date.now() + 7 * 86400000);
    const to = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    act(d, "deferred", { deferred_to: to });
  };

  if (pending.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>
        ⚖️ Waiting on you ({pending.length})
      </Text>
      {pending.map((d) => (
        <View key={d.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.md, marginBottom: spacing.sm }}>
          {/* REQ-F48: the item is a link to its URL-addressable home */}
          <TouchableOpacity onPress={() => router.push(`/decision/${d.id}`)}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{d.title}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{d.proposal}</Text>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
            Silence: {d.silence_means}
            {d.closes_at ? ` · closes ${d.closes_at}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity onPress={() => act(d, "approved")} style={{ flex: 1, backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.xs, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bg }}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => veto(d)} style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.sm, padding: spacing.xs, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger }}>Veto</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => defer(d)} style={{ flex: 1, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.xs, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary }}>Defer +7d</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
