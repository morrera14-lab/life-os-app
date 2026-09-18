// Manager conversation — APP-006. The companion is one prompt away and never
// cold: manager_chat loads this domain's tasks/captures/memory server-side
// (under the user's own RLS) before Claude answers. The Manager proposes;
// the user acts in the app (ADR-008 rule 2).
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

type Msg = { role: "user" | "assistant"; content: string };

export default function ManagerChat() {
  const { domainId } = useLocalSearchParams<{ domainId: string }>();
  const [domainName, setDomainName] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    logEvent("surface_view", { source_view: "manager-chat", item_type: "domain", item_id: String(domainId) });
    supabase
      .from("domains")
      .select("name,icon")
      .eq("id", domainId)
      .maybeSingle()
      .then(({ data }) => setDomainName(data ? `${data.icon ?? ""} ${data.name} Manager`.trim() : "Manager"));
  }, [domainId]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<{ reply: string }>("manager_chat", {
      body: { domain_id: domainId, messages: next },
    });
    setBusy(false);
    setMessages([
      ...next,
      {
        role: "assistant",
        content: error || !data?.reply ? "I couldn't reach your data just now — try again in a moment." : data.reply,
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.goldDeep }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.goldBright }}>{domainName}</Text>
        <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>
          Knows your data already — suggests, never acts for you.
        </Text>
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {messages.length === 0 && (
          <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 14, color: colors.textSecondary }}>
            Ask anything — "what's slipping?", "what should I do first?", "what have I been capturing lately?"
          </Text>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              backgroundColor: m.role === "user" ? colors.surfaceRaised : colors.surface,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.goldDeep,
              padding: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{m.content}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator color={colors.gold} style={{ alignSelf: "flex-start", margin: spacing.sm }} />}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md }}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!busy}
          placeholder="Ask your manager…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={send}
          returnKeyType="send"
          style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.md, padding: spacing.sm }}
        />
        <TouchableOpacity
          onPress={send}
          disabled={busy || !text.trim()}
          style={{ backgroundColor: colors.gold, borderRadius: radii.md, paddingHorizontal: spacing.md, justifyContent: "center", opacity: text.trim() && !busy ? 1 : 0.5 }}
        >
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.bg }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
