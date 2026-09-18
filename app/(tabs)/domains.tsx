// Domains — each domain's Manager as a first-class companion (APP-006).
// A card per domain: identity, what's open, latest activity — and "Ask" is one
// tap into a conversation that already carries the user's data (manager_chat).
// The org chart the user talks to, single-user (no vault vocabulary).
import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type DomainCard = {
  id: string;
  name: string;
  icon: string | null;
  colour: string | null;
  openTasks: number;
  lastActivity: string | null;
  week: number;   // captures, trailing 7 days
  prev: number;   // captures, the 7 days before that
};

export default function Domains() {
  const [cards, setCards] = useState<DomainCard[] | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const { data: domains } = await supabase
      .from("domains")
      .select("id,name,icon,colour")
      .is("archived_at", null)
      .order("sort_order");
    const { data: tasks } = await supabase.from("tasks").select("domain_id").eq("status", "open");
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: notes } = await supabase
      .from("notes")
      .select("domain_id,created_at")
      .gte("created_at", twoWeeksAgo)
      .order("created_at", { ascending: false });
    const openBy: Record<string, number> = {};
    for (const t of tasks ?? []) openBy[t.domain_id] = (openBy[t.domain_id] ?? 0) + 1;
    const lastBy: Record<string, string> = {};
    const weekBy: Record<string, number> = {};
    const prevBy: Record<string, number> = {};
    const weekAgo = Date.now() - 7 * 86400000;
    for (const n of notes ?? []) {
      if (!(n.domain_id in lastBy)) lastBy[n.domain_id] = n.created_at;
      if (Date.parse(n.created_at) >= weekAgo) weekBy[n.domain_id] = (weekBy[n.domain_id] ?? 0) + 1;
      else prevBy[n.domain_id] = (prevBy[n.domain_id] ?? 0) + 1;
    }
    setCards(
      (domains ?? []).map((d) => ({
        ...d,
        openTasks: openBy[d.id] ?? 0,
        lastActivity: lastBy[d.id] ?? null,
        week: weekBy[d.id] ?? 0,
        prev: prevBy[d.id] ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    logEvent("surface_view", { source_view: "domains" });
    load();
  }, [load]);

  if (!cards) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>
        Each area of your life has a manager who already knows it. Ask anything.
      </Text>
      {cards.map((d) => (
        <View key={d.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: 24 }}>{d.icon ?? "◆"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.goldBright }}>{d.name}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary }}>
                {d.openTasks === 0 ? "nothing open" : `${d.openTasks} open task${d.openTasks === 1 ? "" : "s"}`}
                {` · ${d.week} capture${d.week === 1 ? "" : "s"} this week ${d.week > d.prev ? "↑" : d.week < d.prev ? "↓" : "→"}`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/manager/${d.id}`)}
              style={{ backgroundColor: colors.gold, borderRadius: radii.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}
            >
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bg }}>Ask</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
