// Onboarding — APP-050 (REQ-F08 + PARITY-06 + F35/F36 as "later" cards).
// Gated by the root layout right after consent: profiles.onboarded_at is the
// flag. Four short steps, every one skippable without shame, under three
// minutes: briefing time → three intentions → primary domain → brain-dump
// (each line becomes a capture through the normal router). Health & wearables
// and iPhone integrations show as "arrives with the native build" cards —
// promised honestly, not faked with a toggle that does nothing.
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { setFact } from "@/lib/profileFacts";
import { localISODate } from "@/components/CaptureBar";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export const onboardedFlagKey = (uid: string) => `onboarded_${uid}`;
const TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [time, setTime] = useState("06:30");
  const [intentions, setIntentions] = useState(["", "", ""]);
  const [domains, setDomains] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [dump, setDump] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    logEvent("surface_view", { source_view: "onboarding" });
    supabase.from("domains").select("id,name,icon").is("archived_at", null).order("sort_order")
      .then(({ data }) => setDomains(data ?? []));
  }, []);

  async function finish() {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) { setSaving(false); return; }
    await supabase.from("profiles").update({
      briefing_time: time,
      intentions: intentions.map((s) => s.trim()).filter(Boolean),
      primary_domain_id: primary,
      display_name: name.trim() || null,
      onboarded_at: new Date().toISOString(),
    }).eq("id", uid);
    if (city.trim()) await setFact("home.city", city.trim());
    await setFact("home.timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    // PARITY-06 brain-dump: every line through the same router as any capture.
    const lines = dump.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
    for (const text of lines) {
      await supabase.functions.invoke("route_capture", { body: { text, today: localISODate() } });
    }
    logEvent("onboarding_completed", { source_view: "onboarding", metadata: { dump_lines: lines.length, primary } });
    try { await AsyncStorage.setItem(onboardedFlagKey(uid), "1"); } catch { /* cache only */ }
    router.replace("/");
  }

  const Btn = ({ label, onPress, primary: p = true, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) => (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={{ backgroundColor: p ? colors.gold : "transparent", borderWidth: 1, borderColor: p ? colors.gold : colors.goldDeep, borderRadius: radii.md, padding: spacing.md, alignItems: "center", opacity: disabled ? 0.5 : 1, flex: 1 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: p ? colors.bg : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
  const input = (v: string, set: (s: string) => void, ph: string, multi = false) => (
    <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted} multiline={multi}
      style={{ fontFamily: fonts.body, fontSize: 16, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, minHeight: multi ? 140 : undefined, textAlignVertical: multi ? "top" : undefined }} />
  );

  const steps = [
    {
      title: "When does your day start?",
      sub: "Your briefing arrives at this time — content, not a nudge to open the app.",
      body: (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TIMES.map((t) => (
            <TouchableOpacity key={t} onPress={() => setTime(t)} style={{ borderWidth: 1, borderColor: time === t ? colors.gold : colors.goldDeep, backgroundColor: time === t ? colors.surfaceRaised : colors.surface, borderRadius: radii.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: time === t ? colors.gold : colors.text }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ),
    },
    {
      title: "Three intentions for this week",
      sub: "Not goals for the year — what would make this week feel right. Blank is fine.",
      body: <View>{intentions.map((v, i) => <View key={i}>{input(v, (s) => setIntentions((arr) => arr.map((x, j) => (j === i ? s : x))), `Intention ${i + 1}`)}</View>)}</View>,
    },
    {
      title: "Which area needs you most right now?",
      sub: "Your primary domain leads the briefing. You can change it any time.",
      body: (
        <View>
          {input(name, setName, "What should we call you? (first name)")}
          {input(city, setCity, "Home city (for weather and timing, later)")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
            {domains.map((d) => (
              <TouchableOpacity key={d.id} onPress={() => setPrimary(d.id)} style={{ borderWidth: 1, borderColor: primary === d.id ? colors.gold : colors.goldDeep, backgroundColor: primary === d.id ? colors.surfaceRaised : colors.surface, borderRadius: radii.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: primary === d.id ? colors.gold : colors.text }}>{d.icon ?? ""} {d.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ),
    },
    {
      title: "Empty your head",
      sub: "Everything circling — one thing per line. Each one gets sorted into the right place. Skip if there's nothing.",
      body: (
        <View>
          {input(dump, setDump, "Call Mum back\nGym Tuesday\nPray for Dami's interview\n…", true)}
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft }}>Health & wearables · iPhone integrations</Text>
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>Apple Health sync and Siri shortcuts arrive with the first native build — nothing to set up yet, and we'll ask then.</Text>
          </View>
        </View>
      ),
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl * 2 }}>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs }}>{step + 1} of {steps.length}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.goldBright }}>{s.title}</Text>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>{s.sub}</Text>
        {s.body}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          {step > 0 && <Btn label="Back" primary={false} onPress={() => setStep(step - 1)} />}
          {saving ? <ActivityIndicator color={colors.gold} style={{ flex: 1 }} /> : <Btn label={last ? "Start" : "Next"} onPress={() => (last ? finish() : setStep(step + 1))} />}
        </View>
        {!last && (
          <TouchableOpacity onPress={() => setStep(step + 1)} style={{ alignItems: "center", marginTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textMuted }}>Skip this one</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
