// manager_chat — REQ-F57's read side made conversational (APP-006):
// each domain's Manager as a companion who already knows the user's data.
// The client sends {domain_id, messages}; this function loads THAT domain's
// context under the caller's own RLS (anon key + passed-through JWT — it can
// only ever see the caller's rows), assembles the Manager persona, and asks
// Claude. ADR-008 rule 2 holds: the Manager PROPOSES — this function writes
// nothing; every suggestion is something the user does in the app themselves.
import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5"; // AI_MANAGEMENT §2 — one constant, never scattered

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }
  const { domain_id, messages } = (await req.json()) as { domain_id?: string; messages?: Msg[] };
  if (!domain_id || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "domain_id and messages required" }), { status: 400 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Context under the caller's own RLS — the Manager knows what the user knows.
  const [domainQ, tasksQ, notesQ, memoryQ] = await Promise.all([
    supabase.from("domains").select("id,name,icon").eq("id", domain_id).maybeSingle(),
    supabase
      .from("tasks")
      .select("title,due_date,status,effort_minutes")
      .eq("domain_id", domain_id)
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("notes")
      .select("title,item_type,created_at")
      .eq("domain_id", domain_id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("memory").select("content").order("updated_at", { ascending: false }).limit(5),
  ]);

  const domain = domainQ.data;
  if (!domain) {
    return new Response(JSON.stringify({ error: "domain not found" }), { status: 404 });
  }

  const context = [
    `Open ${domain.name} tasks (soonest due first): ${
      (tasksQ.data ?? []).map((t) => `${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("; ") || "none"
    }.`,
    `Recent ${domain.name} captures: ${
      (notesQ.data ?? []).map((n) => `${n.title} [${n.item_type}]`).join("; ") || "none"
    }.`,
    `What the app remembers about the user: ${
      (memoryQ.data ?? []).map((m) => m.content).join(" · ") || "nothing recorded yet"
    }.`,
  ].join("\n");

  const system =
    `You are the user's ${domain.name} Manager inside their Life OS app — a warm, direct companion ` +
    `who already knows their ${domain.name} data (below) and never needs it re-explained. ` +
    `Be concise (under 150 words unless asked), concrete, and kind without flattery. ` +
    `You PROPOSE, never act: suggest what the user could capture, complete, close, or reconsider — ` +
    `phrased as suggestions they can do in the app, never as things you have done. ` +
    `Never invent data not shown below; say plainly when you don't know.\n\n${context}`;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "manager unavailable" }), { status: 503 });
  }
  const anthropic = new Anthropic({ apiKey });
  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: messages.slice(-12),
  });
  const text = resp.content
    .filter((b): b is { type: "text"; text: string; citations: never } => b.type === "text")
    .map((b) => b.text)
    .join("");

  console.log(JSON.stringify({ event: "manager_chat.ok", model: MODEL, domain: domain.name, latency_ms: Date.now() - t0 }));
  return new Response(JSON.stringify({ reply: text, latency_ms: Date.now() - t0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
