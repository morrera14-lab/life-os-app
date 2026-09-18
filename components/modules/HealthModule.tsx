// Health module — APP-002. Recovery / sleep / strain / resting HR per day from
// `health_metrics`. Today's ONLY working source in Expo Go is `declared` — the
// user types the numbers off their Whoop (LOC-092's declared-shape fallback):
// HealthKit (ADR-005) and the direct WHOOP API (REQ-V1-15) are native paths
// that ride the dev-client build. The declared row already drives PARITY-08:
// the cockpit reads today's recovery and scales the capacity budget.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { localISODate } from "@/components/CaptureBar";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Metric = { day: string; recovery: number | null; sleep_hours: number | null; strain: number | null; resting_hr: number | null; source: string };

const band = (r: number | null) => (r == null ? colors.textMuted : r < 34 ? colors.danger : r < 67 ? colors.warning : colors.success);

export function HealthModule() {
  const [rows, setRows] = useState<Metric[]>([]);
  const [rec, setRec] = useState(""); const [sleep, setSleep] = useState(""); const [strain, setStrain] = useState(""); const [rhr, setRhr] = useState("");
  const [saving, setSaving] = useState(false);
  const today = localISODate();

  const load = useCallback(async () => {
    const { data } = await supabase.from("health_metrics").select("day,recovery,sleep_hours,strain,resting_hr,source").order("day", { ascending: false }).limit(7);
    setRows((data ?? []) as Metric[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const todayRow = rows.find((r) => r.day === today);

  async function save() {
    if (saving) return;
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id; if (!uid) { setSaving(false); return; }
    const row = {
      user_id: uid, day: today, source: "declared",
      recovery: rec ? Number(rec) : null, sleep_hours: sleep ? Number(sleep) : null,
      strain: strain ? Number(strain) : null, resting_hr: rhr ? Number(rhr) : null,
    };
    await supabase.from("health_metrics").upsert(row, { onConflict: "user_id,day" });
    logEvent("health_declared", { source_view: "health", metadata: { recovery: row.recovery } });
    setRec(""); setSleep(""); setStrain(""); setRhr(""); setSaving(false); load();
  }

  const num = (v: string, set: (s: string) => void, ph: string) => (
    <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad"
      style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm }} />
  );

  return (
    <View>
      {/* Today — the primary fact first (UI pattern #3) */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md, alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: band(todayRow?.recovery ?? null) }}>{todayRow?.recovery ?? "—"}</Text>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textSecondary }}>
          {todayRow ? `recovery today · sleep ${todayRow.sleep_hours ?? "—"}h · strain ${todayRow.strain ?? "—"} · RHR ${todayRow.resting_hr ?? "—"}` : "no reading for today yet"}
        </Text>
        {todayRow && <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>source: {todayRow.source}</Text>}
      </View>

      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft, marginBottom: spacing.xs }}>Log today (from your Whoop)</Text>
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{num(rec, setRec, "recovery %")}{num(sleep, setSleep, "sleep h")}</View>
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>{num(strain, setStrain, "strain")}{num(rhr, setRhr, "resting HR")}</View>
      <TouchableOpacity onPress={save} disabled={saving || !(rec || sleep || strain || rhr)} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: rec || sleep || strain || rhr ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Save</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
        Low recovery shrinks today's capacity budget automatically. Automatic sync (Apple Health / Whoop) arrives with the first native build.
      </Text>

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginTop: spacing.md, marginBottom: spacing.sm }}>Last 7 days</Text>
      {rows.length === 0 ? <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary }}>Nothing logged yet.</Text> :
        rows.map((r) => (
          <View key={r.day} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.goldDeep }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary }}>{r.day}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: band(r.recovery) }}>{r.recovery ?? "—"}%</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary }}>{r.sleep_hours ?? "—"}h · {r.strain ?? "—"}</Text>
          </View>
        ))}
    </View>
  );
}
