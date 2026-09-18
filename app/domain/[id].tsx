// Domain detail — the URL-addressable home of each domain (REQ-F48), routing
// to that domain's module by name: Faith (APP-004), Health (APP-002),
// Learning (APP-007), Career (APP-008). Any other domain gets the generic
// view (open tasks + recent captures). Modules are components, so the same
// module can later render inside a domain a user renamed.
import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { colors, fonts, spacing, radii } from "@/lib/theme";
import { FaithModule } from "@/components/modules/FaithModule";
import { HealthModule } from "@/components/modules/HealthModule";
import { LearningModule } from "@/components/modules/LearningModule";
import { CareerModule } from "@/components/modules/CareerModule";

type Domain = { id: string; name: string; icon: string | null };

export default function DomainDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [domain, setDomain] = useState<Domain | null | "missing">(null);

  useEffect(() => {
    logEvent("surface_view", { source_view: "domain", item_type: "domain", item_id: String(id) });
    supabase.from("domains").select("id,name,icon").eq("id", id).maybeSingle()
      .then(({ data }) => setDomain((data as Domain) ?? "missing"));
  }, [id]);

  if (domain === null) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.gold} /></View>;
  }
  if (domain === "missing") {
    return <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}><Text style={{ fontFamily: fonts.bodyItalic, color: colors.textSecondary, textAlign: "center" }}>That domain isn't here.</Text></View>;
  }

  const name = domain.name.toLowerCase();
  const module =
    name === "faith" ? <FaithModule domainId={domain.id} /> :
    name === "health" ? <HealthModule /> :
    name === "learning" ? <LearningModule /> :
    name === "career" ? <CareerModule domainId={domain.id} /> :
    <GenericDomain domainId={domain.id} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl * 2, paddingBottom: spacing.xl * 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.goldBright }}>{domain.icon ?? ""} {domain.name}</Text>
        <TouchableOpacity onPress={() => router.push(`/manager/${domain.id}`)} style={{ backgroundColor: colors.gold, borderRadius: radii.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bg }}>Ask</Text>
        </TouchableOpacity>
      </View>
      {module}
    </ScrollView>
  );
}

function GenericDomain({ domainId }: { domainId: string }) {
  const [tasks, setTasks] = useState<{ id: string; title: string; due_date: string | null }[]>([]);
  useEffect(() => {
    supabase.from("tasks").select("id,title,due_date").eq("domain_id", domainId).eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).limit(20)
      .then(({ data }) => setTasks((data ?? []) as typeof tasks));
  }, [domainId]);
  return (
    <View>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.goldSoft, marginBottom: spacing.sm }}>Open</Text>
      {tasks.length === 0 ? <Text style={{ fontFamily: fonts.bodyItalic, color: colors.textSecondary }}>Nothing open here.</Text> :
        tasks.map((t) => (
          <View key={t.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.goldDeep, padding: spacing.sm, marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{t.title}{t.due_date ? `  · ${t.due_date}` : ""}</Text>
          </View>
        ))}
    </View>
  );
}
