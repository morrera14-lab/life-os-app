// Habits — APP-053, on the tables that have waited since 2026-08-17 (migration
// 03). LOC-039's one time model: a habit is a RHYTHM (recurs, weekly_goal N/7);
// today's tick is the SCHEDULE answering "what happened today". Toggle =
// insert/delete a completion (REQ-F18); 'rest' = the REQ-F37 grace day. The
// week strip (LOC-066) shows the last 7 days — dots, never a streak counter
// that breaks. Devotional-section habits tick HERE and only here (REQ-F43).
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { localISODate } from "@/components/CaptureBar";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Habit = { id: string; label: string; icon: string | null; section: "daily" | "devotional"; weekly_goal: number };
type Completion = { habit_id: string; on_date: string; status: "done" | "rest" };

function dateShift(iso: string, days: number) {
  const d = new Date(Date.parse(iso) + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Habits() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [comps, setComps] = useState<Completion[]>([]);
  const [label, setLabel] = useState("");
  const [section, setSection] = useState<"daily" | "devotional">("daily");
  const [goal, setGoal] = useState(7);
  const today = localISODate();
  const weekStart = dateShift(today, -6);
  const week = Array.from({ length: 7 }, (_, i) => dateShift(today, i - 6));

  const load = useCallback(async () => {
    const [{ data: h }, { data: c }] = await Promise.all([
      supabase.from("habits").select("id,label,icon,section,weekly_goal").is("archived_at", null).order("sort_order"),
      supabase.from("habit_completions").select("habit_id,on_date,status").gte("on_date", weekStart),
    ]);
    setHabits((h ?? []) as Habit[]); setComps((c ?? []) as Completion[]);
  }, [weekStart]);

  useEffect(() => { logEvent("surface_view", { source_view: "habits" }); load(); }, [load]);

  const status = (hid: string, day: string) => comps.find((c) => c.habit_id === hid && c.on_date === day)?.status ?? null;

  async function toggle(h: Habit) {
    const cur = status(h.id, today);
    const { data } = await supabase.auth.getUser(); const uid = data.user?.id; if (!uid) return;
    if (cur === "done") {
      setComps((c) => c.filter((x) => !(x.habit_id === h.id && x.on_date === today)));
      await supabase.from("habit_completions").delete().eq("habit_id", h.id).eq("on_date", today);
    } else {
      setComps((c) => [...c.filter((x) => !(x.habit_id === h.id && x.on_date === today)), { habit_id: h.id, on_date: today, status: "done" }]);
      logEvent("item_done", { source_view: "habits", item_type: "habit", item_id: h.id });
      await supabase.from("habit_completions").upsert({ user_id: uid, habit_id: h.id, on_date: today, status: "done" }, { onConflict: "habit_id,on_date" });
    }
  }
  async function rest(h: Habit) {
    const { data } = await supabase.auth.getUser(); const uid = data.user?.id; if (!uid) return;
    setComps((c) => [...c.filter((x) => !(x.habit_id === h.id && x.on_date === today)), { habit_id: h.id, on_date: today, status: "rest" }]);
    await supabase.from("habit_completions").upsert({ user_id: uid, habit_id: h.id, on_date: today, status: "rest" }, { onConflict: "habit_id,on_date" });
  }
  async function add() {
    if (!label.trim()) return;
    const { data } = await supabase.auth.getUser(); const uid = data.user?.id; if (!uid) return;
    await supabase.from("habits").insert({ user_id: uid, label: label.trim(), section, weekly_goal: goal, sort_order: habits?.length ?? 0 });
    logEvent("habit_created", { source_view: "habits" }); setLabel(""); load();
  }

  const weekDone = (hid: string) => comps.filter((c) => c.habit_id === hid && c.status === "done").length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
      {habits && habits.length === 0 && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md }}>
          <Text style={{ fontSize: 30 }}>🌱</Text>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs }}>Rhythms, not rules. Add one below — "5 of 7" is a real goal.</Text>
        </View>
      )}
      {(["daily", "devotional"] as const).map((sec) => {
        const list = (habits ?? []).filter((h) => h.section === sec);
        if (list.length === 0) return null;
        return (
          <View key={sec} style={{ marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>{sec === "daily" ? "Daily" : "Devotional"}</Text>
            {list.map((h) => {
              const t = status(h.id, today);
              return (
                <View key={h.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: t === "done" ? colors.gold : colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity onPress={() => toggle(h)} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: t === "done" ? colors.gold : colors.goldDeep, backgroundColor: t === "done" ? colors.gold : "transparent", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
                      <Text style={{ color: colors.bg, fontSize: 16 }}>{t === "done" ? "✓" : t === "rest" ? "·" : ""}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{h.icon ?? ""} {h.label}</Text>
                      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>{weekDone(h.id)} of {h.weekly_goal} this week{t === "rest" ? " · resting today" : ""}</Text>
                    </View>
                    {t !== "done" && t !== "rest" && (
                      <TouchableOpacity onPress={() => rest(h)}><Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, padding: spacing.xs }}>rest</Text></TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.xs, marginLeft: 38 }}>
                    {week.map((d) => { const st = status(h.id, d); return <View key={d} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st === "done" ? colors.gold : st === "rest" ? colors.goldDeep : colors.surfaceRaised }} />; })}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft, marginBottom: spacing.xs }}>Add a rhythm</Text>
      <TextInput value={label} onChangeText={setLabel} placeholder="Morning prayer · Gym · Read 10 pages" placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.xs }} />
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs, alignItems: "center" }}>
        {(["daily", "devotional"] as const).map((s) => (
          <TouchableOpacity key={s} onPress={() => setSection(s)} style={{ borderWidth: 1, borderColor: section === s ? colors.gold : colors.goldDeep, borderRadius: radii.sm, paddingVertical: 4, paddingHorizontal: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: section === s ? colors.gold : colors.textSecondary }}>{s}</Text>
          </TouchableOpacity>
        ))}
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginLeft: spacing.xs }}>goal</Text>
        {[3, 5, 7].map((g) => (
          <TouchableOpacity key={g} onPress={() => setGoal(g)} style={{ borderWidth: 1, borderColor: goal === g ? colors.gold : colors.goldDeep, borderRadius: radii.sm, paddingVertical: 4, paddingHorizontal: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: goal === g ? colors.gold : colors.textSecondary }}>{g}/7</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={add} disabled={!label.trim()} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: label.trim() ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Add</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
