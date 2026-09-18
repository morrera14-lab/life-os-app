// Universal Capture — REQ-F03/F04 (+ APP-009: one component, every screen).
// Extracted from app/(tabs)/capture.tsx so the SAME routing flow (route_capture,
// server-calibrated needs_confirmation, keep/move correction) renders as the
// full Capture screen AND as the compact bar on Home — REQ-F03's "accessible
// from any screen" stops being a tab you must switch to.
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";

export type RouteResult = {
  table: "tasks" | "notes";
  item_id: string;
  domain: string;
  domain_id: string;
  item_type: "task" | "note" | "prayer";
  title: string;
  due_date: string | null;
  confidence: number | null;
  alternative: { domain: string; domain_id: string } | null;
  needs_confirmation: boolean;
  fallback: boolean;
  fallback_reason?: string;
  latency_ms: number;
};

// Device-local calendar date, so "Friday" resolves in the user's own day, not UTC's.
export function localISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TYPE_LABEL: Record<RouteResult["item_type"], string> = {
  task: "task",
  note: "note",
  prayer: "prayer request",
};

export function CaptureBar({ compact = false, sourceView = "capture", onRouted }: {
  compact?: boolean;
  sourceView?: string;
  onRouted?: (r: RouteResult) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);

  async function route(body: Record<string, unknown>): Promise<RouteResult | null> {
    const { data, error } = await supabase.functions.invoke<RouteResult>("route_capture", { body });
    if (error || !data) {
      Alert.alert("Couldn't sort that", error?.message ?? "No response — try again.");
      return null;
    }
    return data;
  }

  async function submit() {
    const capture = text.trim();
    if (!capture || busy) return;
    setBusy(true);
    const res = await route({ text: capture, today: localISODate() });
    setBusy(false);
    if (!res) return;
    setResult(res);
    setText("");
    logEvent("capture_created", { source_view: sourceView, item_type: res.item_type, item_id: res.item_id });
    onRouted?.(res);
  }

  // US-03: user picks the alternative — remove the first filing, re-file by hand.
  async function moveTo(alt: NonNullable<RouteResult["alternative"]>) {
    if (!result || busy) return;
    setBusy(true);
    const raw = result.title;
    await supabase.from(result.table).delete().eq("id", result.item_id);
    const res = await route({
      text: raw,
      domain_id: alt.domain_id,
      item_type: result.item_type,
      due_date: result.due_date,
    });
    setBusy(false);
    if (res) {
      setResult(res);
      onRouted?.(res);
    }
  }

  return (
    <View>
      <View style={compact ? { flexDirection: "row", gap: spacing.sm } : undefined}>
        <TextInput
          placeholder={compact ? "Capture a thought…" : "Pray for Mum's health · Chest workout Friday · Email Sarah about the project"}
          placeholderTextColor={colors.textMuted}
          multiline={!compact}
          value={text}
          onChangeText={setText}
          editable={!busy}
          onSubmitEditing={compact ? submit : undefined}
          returnKeyType={compact ? "send" : undefined}
          style={{
            fontFamily: fonts.body,
            fontSize: compact ? 15 : 17,
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.goldDeep,
            borderWidth: 1,
            borderRadius: radii.md,
            padding: compact ? spacing.sm : spacing.md,
            ...(compact ? { flex: 1 } : { minHeight: 110, textAlignVertical: "top" as const }),
          }}
        />
        <TouchableOpacity
          disabled={busy || !text.trim()}
          onPress={submit}
          style={{
            backgroundColor: colors.gold,
            borderRadius: radii.md,
            padding: compact ? spacing.sm : spacing.md,
            alignItems: "center",
            justifyContent: "center",
            ...(compact ? {} : { marginTop: spacing.md }),
            opacity: text.trim() && !busy ? 1 : 0.5,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: compact ? 15 : 18, color: colors.bg }}>
              {compact ? "Sort" : "Sort it"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <View
          style={{
            marginTop: compact ? spacing.sm : spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: result.needs_confirmation ? colors.goldSoft : colors.goldDeep,
            padding: compact ? spacing.sm : spacing.md,
          }}
        >
          <Text style={{ fontFamily: compact ? fonts.bodyMedium : fonts.display, fontSize: compact ? 14 : 18, color: colors.goldBright }}>
            {result.fallback ? `Saved to ${result.domain} — unsorted` : `Added to ${result.domain} → ${TYPE_LABEL[result.item_type]}`}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: compact ? 14 : 16, color: colors.text, marginTop: spacing.xs }}>
            {result.title}
            {result.due_date ? `  ·  due ${result.due_date}` : ""}
          </Text>
          {!compact && (
            <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs }}>
              {result.fallback
                ? "Sorting is offline right now — it's safe, just unsorted."
                : `${(result.latency_ms / 1000).toFixed(1)}s · confidence ${Math.round((result.confidence ?? 0) * 100)}%`}
            </Text>
          )}

          {result.needs_confirmation && result.alternative && !result.fallback && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs }}>
                Not sure — keep it here, or move it?
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={() => setResult({ ...result, needs_confirmation: false })}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.gold, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.gold }}>Keep in {result.domain}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveTo(result.alternative!)}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.goldDeep, borderRadius: radii.sm, padding: spacing.sm, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>Move to {result.alternative.domain}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {compact && (
            <TouchableOpacity onPress={() => setResult(null)} style={{ marginTop: spacing.xs }}>
              <Text style={{ fontFamily: fonts.bodyItalic, fontSize: 12, color: colors.textMuted }}>dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
