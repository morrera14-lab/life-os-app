// Learning module — APP-007. Readwise's shape, not Anki's: a fixed ≤5-prompt
// daily session drawn from what's due, capacity-bounded, and "overdue" is not
// a concept — a prompt due last week is simply due, with no count shamed at
// the user (the ADHD-cockpit pattern, arrived at independently — REQ-V1-09,
// Learning charter 2026-08-01). Spacing: got it → interval doubles; again →
// back to 1 day. Prompts are user-authored here; module/course import rides
// the vault-import path later.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { localISODate } from "@/components/CaptureBar";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Prompt = { id: string; prompt: string; answer: string; source: string | null; interval_days: number; reps: number };
const SESSION_SIZE = 5;

export function LearningModule() {
  const [session, setSession] = useState<Prompt[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [q, setQ] = useState(""); const [a, setA] = useState(""); const [src, setSrc] = useState("");
  const today = localISODate();

  const load = useCallback(async () => {
    const { data } = await supabase.from("learning_prompts").select("id,prompt,answer,source,interval_days,reps")
      .is("archived_at", null).lte("next_due", today).order("next_due", { ascending: true }).limit(SESSION_SIZE);
    setSession((data ?? []) as Prompt[]); setRevealed(false);
  }, [today]);
  useEffect(() => { load(); }, [load]);

  async function grade(p: Prompt, gotIt: boolean) {
    const interval = gotIt ? Math.min(p.interval_days * 2, 120) : 1;
    const d = new Date(Date.parse(today) + interval * 86400000);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSession((s) => s.filter((x) => x.id !== p.id)); setRevealed(false); setDone((n) => n + 1);
    logEvent("prompt_reviewed", { source_view: "learning", item_type: "prompt", item_id: p.id, metadata: { got_it: gotIt } });
    await supabase.from("learning_prompts").update({ interval_days: interval, reps: p.reps + 1, next_due: next }).eq("id", p.id);
  }

  async function add() {
    if (!q.trim() || !a.trim()) return;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id; if (!uid) return;
    await supabase.from("learning_prompts").insert({ user_id: uid, prompt: q.trim(), answer: a.trim(), source: src.trim() || null });
    logEvent("prompt_created", { source_view: "learning" });
    setQ(""); setA(""); setSrc(""); load();
  }

  const cur = session[0];
  const input = (v: string, set: (s: string) => void, ph: string, multi = false) => (
    <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted} multiline={multi}
      style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.xs, minHeight: multi ? 60 : undefined }} />
  );

  return (
    <View>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>Today's review</Text>
      {cur ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.text }}>{cur.prompt}</Text>
          {cur.source && <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{cur.source}</Text>}
          {revealed ? (
            <>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.goldSoft, marginTop: spacing.sm }}>{cur.answer}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity onPress={() => grade(cur, true)} style={{ flex: 1, backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}><Text style={{ fontFamily: fonts.bodyMedium, color: colors.bg }}>Got it</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => grade(cur, false)} style={{ flex: 1, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}><Text style={{ fontFamily: fonts.bodyMedium, color: colors.text }}>Again</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setRevealed(true)} style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}><Text style={{ fontFamily: fonts.bodyMedium, color: colors.gold }}>Reveal</Text></TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md, alignItems: "center" }}>
          <Text style={{ fontSize: 26 }}>📚</Text>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs }}>
            {done > 0 ? `That's today's session — ${done} reviewed. Tomorrow brings the next.` : "Nothing due today. Add a prompt below from something you're learning."}
          </Text>
        </View>
      )}

      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft, marginBottom: spacing.xs }}>Add a prompt</Text>
      {input(q, setQ, "Question or cue")}{input(a, setA, "Answer", true)}{input(src, setSrc, "Source (book, course, module) — optional")}
      <TouchableOpacity onPress={add} disabled={!q.trim() || !a.trim()} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: q.trim() && a.trim() ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}
