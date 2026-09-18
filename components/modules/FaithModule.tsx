// Faith module — APP-004. Scripture anchor (REQ-F09, pre-loaded KJV, offline),
// prayer requests + devotional notes from the capture path (REQ-F10 — they
// are `notes` rows, item_type prayer/note), and the WordApp handoff (REQ-F22).
// REQ-F43 governs the whole surface: NO completion state — no ticks, no
// "last prayed" dates, no streak. Prayers render as standing invitations.
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { verseForToday } from "@/lib/dailyVerses";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Note = { id: string; title: string; item_type: "note" | "prayer"; created_at: string };

export function FaithModule({ domainId }: { domainId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const verse = verseForToday();

  useEffect(() => {
    supabase.from("notes").select("id,title,item_type,created_at").eq("domain_id", domainId)
      .order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setNotes((data ?? []) as Note[]));
  }, [domainId]);

  const openWordApp = async () => {
    logEvent("item_opened", { source_view: "faith", item_type: "deeplink", metadata: { target: "wordapp" } });
    const url = "wordapp://";
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
    else Alert.alert("WordApp", "WordApp isn't installed on this phone yet — the devotional lives there.");
  };

  const prayers = notes.filter((n) => n.item_type === "prayer");
  const devotional = notes.filter((n) => n.item_type === "note");

  return (
    <View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldSoft, padding: spacing.md, marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 17, color: colors.text, lineHeight: 25 }}>“{verse.text}”</Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.gold, marginTop: spacing.xs }}>— {verse.ref}</Text>
        <TouchableOpacity onPress={openWordApp} style={{ marginTop: spacing.sm, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, paddingVertical: 4, paddingHorizontal: spacing.md }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.goldSoft }}>Today's devotional in WordApp →</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginBottom: spacing.sm }}>Prayer</Text>
      {prayers.length === 0 ? (
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md }}>
          Capture "pray for…" anywhere and it lands here.
        </Text>
      ) : prayers.map((p) => (
        <View key={p.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{p.title}</Text>
        </View>
      ))}

      <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.goldBright, marginTop: spacing.md, marginBottom: spacing.sm }}>Devotional notes</Text>
      {devotional.length === 0 ? (
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary }}>What God is saying to you lately — capture it, it keeps here.</Text>
      ) : devotional.map((n) => (
        <View key={n.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{n.title}</Text>
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>{n.created_at.slice(0, 10)}</Text>
        </View>
      ))}
    </View>
  );
}
