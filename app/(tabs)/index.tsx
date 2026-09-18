// Home — the ADHD Now/Today cockpit as a FEED (APP-010 + APP-040).
// Spec: vault docs/design/HOME-FEED-SPEC.md (REQ-F71). Requirements: REQ-F60
// (capacity-bounded queue — budget + effort from the assumptions registry),
// REQ-F61 (rollover with age badge, keep/reschedule/close at day 3, no shame
// copy), REQ-F62 ("I'm stuck" always visible → ≤7 named session-starters,
// the LOC-013 patterns). Feed default: one shuffled card, ✓ Done + cost-free
// skip, no counts/ranks; ☰ List renders the same picked queue flat. Every
// mode switch and item action logs to the events feed (REQ-F54).
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { CaptureBar, localISODate } from "@/components/CaptureBar";
import { DecisionsFold } from "@/components/DecisionsFold";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  effort_minutes: number | null;
  domain_id: string;
};

type Queue = {
  picked: Task[];
  foldedCount: number;
  budget: number;
  spent: number;
  defaultEffort: number;
};

// LOC-013's seven executive-function patterns, generalised for a single user
// (the mock's 7th, "Claude Code handoff", becomes "hand the first step to the
// app" per the APP-028 transplant rule).
const STARTERS: { key: string; name: string; line: string }[] = [
  { key: "smallest_step", name: "Smallest step", line: "Name the tiniest physical first move — do only that." },
  { key: "body_double", name: "Work alongside", line: "Ten minutes with the timer running beside you. Company, not pressure." },
  { key: "ten_minutes", name: "Just 10 minutes", line: "A visible countdown. When it ends you may stop — you usually won't." },
  { key: "close_loop", name: "Close the last thing", line: "Write one line to park what's still buzzing, then take the top card." },
  { key: "easiest_first", name: "Easiest card first", line: "Momentum before priority — do the round's lightest item." },
  { key: "brain_dump", name: "Dump it", line: "Capture everything circling in your head, then come back empty-handed." },
  { key: "hand_it_over", name: "Hand over the first step", line: "Capture the task with 'draft the first step for…' — let the app carry it." },
];

function daysOverdue(due: string | null, today: string): number {
  if (!due || due >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(due)) / 86400000);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [mode, setMode] = useState<"feed" | "list">("feed");
  const [round, setRound] = useState<Task[]>([]); // shuffled remaining cards this round
  const [stuckOpen, setStuckOpen] = useState(false);
  const [session, setSession] = useState<{ starter: string; endsAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [prompt3, setPrompt3] = useState<string | null>(null); // task id showing 3rd-day prompt
  const [firstName, setFirstName] = useState<string>("");
  const today = localISODate();
  const loadedRef = useRef(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const [{ data: tasks }, { data: assumptions }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,due_date,priority,effort_minutes,domain_id")
        .eq("status", "open")
        .or(`due_date.lte.${today},and(due_date.is.null,priority.eq.high)`)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("assumptions")
        .select("key,value")
        .in("key", ["today.capacity_minutes", "today.default_effort_minutes"]),
    ]);
    const val = (k: string, fallback: number) => {
      const row = (assumptions ?? []).find((a) => a.key === k)?.value as { default?: number; computed?: number } | undefined;
      return row?.computed ?? row?.default ?? fallback;
    };
    const budget = val("today.capacity_minutes", 180);
    const defaultEffort = val("today.default_effort_minutes", 30);
    const picked: Task[] = [];
    let spent = 0;
    let folded = 0;
    for (const t of (tasks ?? []) as Task[]) {
      const cost = t.effort_minutes ?? defaultEffort;
      if (spent + cost <= budget || picked.length === 0) {
        picked.push(t);
        spent += cost;
      } else {
        folded++;
      }
    }
    setQueue({ picked, foldedCount: folded, budget, spent, defaultEffort });
    setRound(shuffle(picked));
  }, [today]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      logEvent("surface_view", { source_view: "home" });
      supabase.from("profiles").select("display_name").maybeSingle()
        .then(({ data }) => setFirstName((data?.display_name ?? "").split(" ")[0]))
        .then(undefined, () => {});
      AsyncStorage.getItem("home_mode")
        .then((m) => {
          if (m === "list" || m === "feed") setMode(m);
        })
        .catch(() => {});
    }
    load();
  }, [load]);

  // focus-session countdown tick
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  const switchMode = (m: "feed" | "list") => {
    setMode(m);
    AsyncStorage.setItem("home_mode", m).catch(() => {});
    logEvent("surface_view", { source_view: m === "feed" ? "home-feed" : "home-list" });
  };

  async function completeTask(t: Task) {
    setRound((r) => r.filter((x) => x.id !== t.id));
    setQueue((q) => (q ? { ...q, picked: q.picked.filter((x) => x.id !== t.id) } : q));
    logEvent("item_done", { source_view: "home", item_type: "task", item_id: t.id });
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
  }

  async function closeTask(t: Task) {
    setRound((r) => r.filter((x) => x.id !== t.id));
    setQueue((q) => (q ? { ...q, picked: q.picked.filter((x) => x.id !== t.id) } : q));
    logEvent("item_closed", { source_view: "home", item_type: "task", item_id: t.id });
    await supabase.from("tasks").update({ status: "closed", cancelled_at: new Date().toISOString() }).eq("id", t.id);
  }

  async function rescheduleTomorrow(t: Task) {
    const d = new Date(Date.parse(today) + 86400000);
    const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setPrompt3(null);
    setRound((r) => r.filter((x) => x.id !== t.id));
    setQueue((q) => (q ? { ...q, picked: q.picked.filter((x) => x.id !== t.id) } : q));
    logEvent("item_rescheduled", { source_view: "home", item_type: "task", item_id: t.id });
    await supabase.from("tasks").update({ due_date: tomorrow }).eq("id", t.id);
  }

  const skip = (t: Task) => {
    // Cost-free by design (REQ-F71): the card goes to the back of the round.
    setRound((r) => [...r.filter((x) => x.id !== t.id), t]);
    logEvent("item_skipped", { source_view: "home-feed", item_type: "task", item_id: t.id });
  };

  const startSession = (key: string, name: string) => {
    setStuckOpen(false);
    setSession({ starter: name, endsAt: Date.now() + 10 * 60 * 1000 });
    logEvent("focus_session_started", { source_view: "home", metadata: { starter: key } });
  };

  if (!queue) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const rolloverBadge = (t: Task) => {
    const age = daysOverdue(t.due_date, today);
    if (age <= 0) return null;
    const ord = age === 1 ? "1st" : age === 2 ? "2nd" : age === 3 ? "3rd" : `${age}th`;
    return (
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.warning }}>
        ↻ {ord} day
      </Text>
    );
  };

  const thirdDayPrompt = (t: Task) =>
    daysOverdue(t.due_date, today) >= 3 && prompt3 === t.id ? (
      <View style={{ marginTop: spacing.sm }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>
          This one keeps travelling with you — your call, no wrong answer:
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {[
            { label: "Keep", fn: () => setPrompt3(null) },
            { label: "Tomorrow", fn: () => rescheduleTomorrow(t) },
            { label: "Let it go", fn: () => closeTask(t) },
          ].map((b) => (
            <TouchableOpacity key={b.label} onPress={b.fn} style={{ flex: 1, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.xs, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text }}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    ) : null;

  const taskCard = (t: Task, feed: boolean) => (
    <View key={t.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: feed ? 0 : spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: feed ? 19 : 16, color: colors.text, marginRight: spacing.sm }}>
          {t.title}
        </Text>
        {rolloverBadge(t)}
      </View>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
        ~{t.effort_minutes ?? queue.defaultEffort} min
      </Text>
      {thirdDayPrompt(t)}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <TouchableOpacity onPress={() => completeTask(t)} style={{ flex: 1, backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>✓ Done</Text>
        </TouchableOpacity>
        {feed && (
          <TouchableOpacity onPress={() => skip(t)} style={{ flex: 1, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>→ Not this one</Text>
          </TouchableOpacity>
        )}
        {daysOverdue(t.due_date, today) >= 3 && prompt3 !== t.id && (
          <TouchableOpacity onPress={() => setPrompt3(t.id)} style={{ borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textSecondary }}>…</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const secondsLeft = session ? Math.max(0, Math.floor((session.endsAt - now) / 1000)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>
        {/* Universal capture — REQ-F03, one bar, every screen (APP-009) */}
        <CaptureBar compact sourceView="home" onRouted={load} />

        {/* Decisions register fold — REQ-F46; renders nothing when empty */}
        <View style={{ marginTop: spacing.md }}>
          <DecisionsFold />
        </View>

        {/* Greeting — UI patterns #2/#5 (APP-044): the day opens with a person, not a list */}
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.goldBright, marginTop: spacing.md }}>
          {(() => { const h = new Date().getHours(); const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; return firstName ? `${g}, ${firstName}` : g; })()}
        </Text>

        {/* Cockpit strip — REQ-F60 */}
        <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldSoft }}>Today</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
            {queue.picked.length === 0
              ? "Nothing on the hook today."
              : `Holds ${queue.picked.length} item${queue.picked.length === 1 ? "" : "s"} · ~${queue.spent} of your ${queue.budget} min`}
            {queue.foldedCount > 0 ? `  ·  ${queue.foldedCount} more waiting — not today` : ""}
          </Text>
          {/* Capacity at a glance — UI pattern #7: the budget as space, filling as the day admits work */}
          {queue.picked.length > 0 && (
            <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 3, marginTop: spacing.xs, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, Math.round((queue.spent / queue.budget) * 100))}%`, height: 6, backgroundColor: colors.goldDeep, borderRadius: 3 }} />
            </View>
          )}
        </View>

        {/* Mode toggle — REQ-F71 */}
        {queue.picked.length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            {(["feed", "list"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => switchMode(m)}
                style={{
                  borderWidth: 1,
                  borderColor: mode === m ? colors.gold : colors.goldDeep,
                  backgroundColor: mode === m ? colors.surfaceRaised : "transparent",
                  borderRadius: radii.sm,
                  paddingVertical: 4,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: mode === m ? colors.gold : colors.textSecondary }}>
                  {m === "feed" ? "🃏 Feed" : "☰ List"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* The agenda */}
        {queue.picked.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.lg, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.goldBright }}>Clear water</Text>
            <Text style={{ fontSize: 28, marginTop: spacing.xs }}>🌊</Text>
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" }}>
              Nothing due, nothing rolling.
            </Text>
            <TouchableOpacity onPress={() => { logEvent("surface_view", { source_view: "home-empty-cta" }); router.push("/capture"); }} style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold }}>Capture what's on your mind</Text>
            </TouchableOpacity>
          </View>
        ) : mode === "feed" ? (
          round.length === 0 ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.lg, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.goldBright }}>That's the round.</Text>
              <TouchableOpacity onPress={() => setRound(shuffle(queue.picked))} style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold }}>Shuffle again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            taskCard(round[0], true)
          )
        ) : (
          queue.picked.map((t) => taskCard(t, false))
        )}
      </ScrollView>

      {/* Focus session banner */}
      {session && (
        <View style={{ position: "absolute", bottom: 76, left: spacing.lg, right: spacing.lg, backgroundColor: colors.surfaceRaised, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, padding: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold }}>
            {session.starter} · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </Text>
          <TouchableOpacity onPress={() => { logEvent("focus_session_ended", { source_view: "home" }); setSession(null); }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary }}>End</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* "I'm stuck" — REQ-F62, always visible */}
      <TouchableOpacity
        onPress={() => { setStuckOpen(true); logEvent("stuck_pressed", { source_view: "home" }); }}
        style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.sm, alignItems: "center" }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.goldSoft }}>I'm stuck</Text>
      </TouchableOpacity>

      {/* Focus Mode — the seven LOC-013 session-starters */}
      <Modal visible={stuckOpen} animationType="slide" transparent onRequestClose={() => setStuckOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, maxHeight: "80%" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 19, color: colors.goldBright, marginBottom: 2 }}>Pick a way in</Text>
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              Stuck is a state, not a verdict. One tap starts a session.
            </Text>
            <ScrollView>
              {STARTERS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => startSession(s.key, s.name)}
                  style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.sm }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.gold }}>{s.name}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: 2 }}>{s.line}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setStuckOpen(false)} style={{ alignItems: "center", padding: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary }}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
