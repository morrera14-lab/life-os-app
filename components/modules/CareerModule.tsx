// Career module — APP-008. LOC-038's lead-with-outcome shape, not a task list:
// the compounding trail (meeting records, sprint snapshots, wins, artefacts —
// `outcome_records`) leads; live tasks follow; stale ones (open >14 days,
// undated) are folded behind a count instead of forming a graveyard. The
// trail is what feeds a monthly review — every record is future evidence.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Rec = { id: string; kind: string; title: string; summary: string | null; occurred_on: string };
type Task = { id: string; title: string; due_date: string | null; created_at: string };
const KINDS = ["win", "meeting", "sprint", "artefact"] as const;
const KIND_GLYPH: Record<string, string> = { win: "🏁", meeting: "🗒", sprint: "🏃", artefact: "📎" };

export function CareerModule({ domainId }: { domainId: string }) {
  const [trail, setTrail] = useState<Rec[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("win");
  const [title, setTitle] = useState(""); const [summary, setSummary] = useState("");
  const [showStale, setShowStale] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("outcome_records").select("id,kind,title,summary,occurred_on").eq("domain_id", domainId).order("occurred_on", { ascending: false }).limit(20),
      supabase.from("tasks").select("id,title,due_date,created_at").eq("domain_id", domainId).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    setTrail((r ?? []) as Rec[]); setTasks((t ?? []) as Task[]);
  }, [domainId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!title.trim()) return;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id; if (!uid) return;
    await supabase.from("outcome_records").insert({ user_id: uid, domain_id: domainId, kind, title: title.trim(), summary: summary.trim() || null });
    logEvent("outcome_recorded", { source_view: "career", metadata: { kind } });
    setTitle(""); setSummary(""); load();
  }

  const staleCutoff = Date.now() - 14 * 86400000;
  const isStale = (t: Task) => !t.due_date && Date.parse(t.created_at) < staleCutoff;
  const live = tasks.filter((t) => !isStale(t));
  const stale = tasks.filter(isStale);

  return (
    <View>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>The trail</Text>
      {trail.length === 0 ? (
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>Nothing recorded yet — the first win below starts it.</Text>
      ) : trail.map((r) => (
        <View key={r.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.sm, marginBottom: spacing.xs }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{KIND_GLYPH[r.kind] ?? "•"} {r.title}</Text>
          {r.summary && <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{r.summary}</Text>}
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>{r.occurred_on} · {r.kind}</Text>
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xs }}>
        {KINDS.map((k) => (
          <TouchableOpacity key={k} onPress={() => setKind(k)} style={{ borderWidth: 1, borderColor: kind === k ? colors.gold : colors.goldDeep, borderRadius: radii.sm, paddingVertical: 3, paddingHorizontal: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: kind === k ? colors.gold : colors.textSecondary }}>{KIND_GLYPH[k]} {k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput value={title} onChangeText={setTitle} placeholder="What happened (one line)" placeholderTextColor={colors.textMuted}
        style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.xs }} />
      <TextInput value={summary} onChangeText={setSummary} placeholder="Why it matters / what it feeds (optional)" placeholderTextColor={colors.textMuted} multiline
        style={{ fontFamily: fonts.body, fontSize: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.xs, minHeight: 50 }} />
      <TouchableOpacity onPress={add} disabled={!title.trim()} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: title.trim() ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Record</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginTop: spacing.lg, marginBottom: spacing.sm }}>Live</Text>
      {live.length === 0 ? <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary }}>Nothing live.</Text> :
        live.map((t) => (
          <View key={t.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{t.title}{t.due_date ? `  · ${t.due_date}` : ""}</Text>
          </View>
        ))}
      {stale.length > 0 && (
        <TouchableOpacity onPress={() => setShowStale((s) => !s)} style={{ marginTop: spacing.xs }}>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textMuted }}>
            {showStale ? "▾" : "▸"} {stale.length} older, undated — folded, not forgotten
          </Text>
        </TouchableOpacity>
      )}
      {showStale && stale.map((t) => (
        <Text key={t.id} style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, paddingVertical: 2 }}>· {t.title}</Text>
      ))}
    </View>
  );
}
