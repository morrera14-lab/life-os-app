// Finances module — APP-052 (LOC-011's debt-free countdown + allocation view).
// Declared figures live in profile_facts (finance.debt, finance.allocation);
// no finance table until Open Banking (LOC-095's GoCardless feed) makes rows
// real — that is the named follow-up. General information, never advice.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { getFacts, setFact } from "@/lib/profileFacts";
import { logEvent } from "@/lib/events";
import { localISODate } from "@/components/CaptureBar";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Debt = { amount: number; target_date: string; label?: string };
type Bucket = { name: string; pct: number };

export function FinancesModule() {
  const [debt, setDebt] = useState<Debt | null>(null);
  const [alloc, setAlloc] = useState<Bucket[]>([]);
  const [amt, setAmt] = useState(""); const [date, setDate] = useState(""); const [bName, setBName] = useState(""); const [bPct, setBPct] = useState("");
  const today = localISODate();

  const load = useCallback(async () => {
    const f = await getFacts(["finance.debt", "finance.allocation"]);
    setDebt((f["finance.debt"] as Debt) ?? null);
    setAlloc((f["finance.allocation"] as Bucket[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const daysLeft = debt?.target_date ? Math.ceil((Date.parse(debt.target_date) - Date.parse(today)) / 86400000) : null;
  const pctTotal = alloc.reduce((s, b) => s + b.pct, 0);

  async function saveDebt() {
    if (!amt) return;
    const d = { amount: Number(amt), target_date: date || debt?.target_date || "", label: "Remaining debt" };
    await setFact("finance.debt", d); logEvent("finance_declared", { source_view: "finances", metadata: { kind: "debt" } });
    setAmt(""); setDate(""); load();
  }
  async function addBucket() {
    if (!bName.trim() || !bPct) return;
    const next = [...alloc.filter((b) => b.name !== bName.trim()), { name: bName.trim(), pct: Number(bPct) }];
    await setFact("finance.allocation", next); logEvent("finance_declared", { source_view: "finances", metadata: { kind: "allocation" } });
    setBName(""); setBPct(""); load();
  }
  const input = (v: string, set: (s: string) => void, ph: string, numeric = false) => (
    <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted} keyboardType={numeric ? "decimal-pad" : "default"}
      style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm }} />
  );

  return (
    <View>
      {/* Primary fact first (UI pattern #3): the countdown or the amount */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.md, marginBottom: spacing.md, alignItems: "center" }}>
        {debt ? (
          <>
            <Text style={{ fontFamily: fonts.display, fontSize: 36, color: daysLeft != null && daysLeft <= 0 ? colors.success : colors.goldBright }}>
              {daysLeft == null ? `£${debt.amount.toLocaleString()}` : daysLeft <= 0 ? "Debt-free" : `${daysLeft} days`}
            </Text>
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textSecondary }}>
              {daysLeft == null ? "remaining" : `to debt-free · £${debt.amount.toLocaleString()} remaining${debt.target_date ? ` · ${debt.target_date}` : ""}`}
            </Text>
          </>
        ) : (
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>Declare what you owe and when it clears — the countdown does the rest.</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{input(amt, setAmt, "remaining £", true)}{input(date, setDate, "clear by YYYY-MM-DD")}</View>
      <TouchableOpacity onPress={saveDebt} disabled={!amt} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: amt ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Save</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginTop: spacing.lg, marginBottom: spacing.sm }}>Allocation</Text>
      {alloc.length === 0 ? <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>Where each pound goes once it's yours — name the buckets.</Text> :
        alloc.map((b) => (
          <View key={b.name} style={{ marginBottom: spacing.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.text }}>{b.name}</Text>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft }}>{b.pct}%</Text>
            </View>
            <View style={{ height: 5, backgroundColor: colors.surface, borderRadius: 3, overflow: "hidden" }}><View style={{ width: `${Math.min(100, b.pct)}%`, height: 5, backgroundColor: colors.goldDeep }} /></View>
          </View>
        ))}
      {alloc.length > 0 && <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: pctTotal === 100 ? colors.textMuted : colors.warning, marginBottom: spacing.xs }}>{pctTotal}% allocated</Text>}
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{input(bName, setBName, "bucket (Giving, Savings, Ring…)")}{input(bPct, setBPct, "%", true)}</View>
      <TouchableOpacity onPress={addBucket} disabled={!bName.trim() || !bPct} style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: bName.trim() && bPct ? 1 : 0.5 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.gold }}>Add bucket</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 11, color: colors.textMuted, marginTop: spacing.sm }}>General information from your own figures — not financial advice. Live bank feed arrives with Open Banking.</Text>
    </View>
  );
}
