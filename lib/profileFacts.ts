// Profile facts store — APP-051 (LOC-063's "de-hardcode every personal fact").
// One home for who/where the user is: home.city / home.timezone / trip
// (REQ-F49, declared never inferred) / manager.<domainId>.name|tone /
// finance.* (APP-052). Every surface reads through here; none hardcodes.
import { supabase } from "./supabase";

export type Trip = { city: string; timezone: string; start: string; end: string };

export async function getFacts(keys?: string[]): Promise<Record<string, unknown>> {
  let q = supabase.from("profile_facts").select("key,value");
  if (keys?.length) q = q.in("key", keys);
  const { data } = await q;
  const out: Record<string, unknown> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

export async function setFact(key: string, value: unknown): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from("profile_facts").upsert({ user_id: uid, key, value }, { onConflict: "user_id,key" });
}

export async function clearFact(key: string): Promise<void> {
  await supabase.from("profile_facts").delete().eq("key", key);
}

// REQ-F49: a declared trip switches every location-bound surface while its
// dates cover today; with none declared, behave exactly as at home.
export function activeTrip(facts: Record<string, unknown>, today: string): Trip | null {
  const t = facts["trip"] as Trip | undefined;
  if (!t?.start || !t?.end) return null;
  return t.start <= today && today <= t.end ? t : null;
}
