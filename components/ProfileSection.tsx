// Profile — APP-050/051: the onboarding fields, editable any time (name,
// briefing time) + REQ-F49's declared trip (never inferred; clearing it
// returns every surface to home behaviour). Reads/writes profiles + the
// profile_facts store.
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { supabase } from "@/lib/supabase";
import { getFacts, setFact, clearFact, type Trip } from "@/lib/profileFacts";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export function ProfileSection() {
  const [name, setName] = useState(""); const [time, setTime] = useState("06:30");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tCity, setTCity] = useState(""); const [tTz, setTTz] = useState(""); const [tStart, setTStart] = useState(""); const [tEnd, setTEnd] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("display_name,briefing_time").maybeSingle().then(({ data }) => {
      setName(data?.display_name ?? ""); setTime((data?.briefing_time ?? "06:30").slice(0, 5));
    });
    getFacts(["trip"]).then((f) => setTrip((f["trip"] as Trip) ?? null));
  }, []);

  async function save() {
    const { data } = await supabase.auth.getUser(); const uid = data.user?.id; if (!uid) return;
    await supabase.from("profiles").update({ display_name: name.trim() || null, briefing_time: time }).eq("id", uid);
    logEvent("profile_updated", { source_view: "settings" }); setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function declareTrip() {
    if (!tCity.trim() || !tStart || !tEnd) return;
    const t: Trip = { city: tCity.trim(), timezone: tTz.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone, start: tStart, end: tEnd };
    await setFact("trip", t); setTrip(t); setTCity(""); setTTz(""); setTStart(""); setTEnd("");
    logEvent("trip_declared", { source_view: "settings", metadata: { city: t.city } });
  }
  async function endTrip() { await clearFact("trip"); setTrip(null); logEvent("trip_cleared", { source_view: "settings" }); }

  const input = (v: string, set: (s: string) => void, ph: string) => (
    <TextInput value={v} onChangeText={set} placeholder={ph} placeholderTextColor={colors.textMuted}
      style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm }} />
  );

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>Profile</Text>
      <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{input(name, setName, "First name")}{input(time, setTime, "Briefing HH:MM")}</View>
      <TouchableOpacity onPress={save} style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold }}>{saved ? "Saved" : "Save profile"}</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.goldSoft, marginTop: spacing.md, marginBottom: spacing.xs }}>Where you are</Text>
      {trip ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.sm }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.text }}>✈️ {trip.city} · {trip.start} → {trip.end} · {trip.timezone}</Text>
          <TouchableOpacity onPress={endTrip} style={{ marginTop: spacing.xs }}><Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textMuted }}>Back home — end trip</Text></TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{input(tCity, setTCity, "Trip city")}{input(tTz, setTTz, "Timezone (optional)")}</View>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>{input(tStart, setTStart, "From YYYY-MM-DD")}{input(tEnd, setTEnd, "To YYYY-MM-DD")}</View>
          <TouchableOpacity onPress={declareTrip} disabled={!tCity.trim() || !tStart || !tEnd} style={{ borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center", opacity: tCity.trim() && tStart && tEnd ? 1 : 0.5 }}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary }}>Declare a trip</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Declared, never inferred — the app never reads your location.</Text>
        </View>
      )}
    </View>
  );
}
