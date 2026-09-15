// route_capture — REQ-F03/F04, US-03. Spec: vault AI_MANAGEMENT.md §1.2 (prompt),
// §2 (Haiku), §4.3 (2.2 s budget), §6 (fallback: never lose a capture).
// Auth: the caller's Supabase JWT is forwarded to supabase-js, so every read and
// write runs under the user's own RLS (REQ-NF07). Domains are read per request
// from the user's `domains` rows — never an enum (REQ-NF08).
import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5"; // AI_MANAGEMENT §2 — one constant, never scattered
const LOW_CONFIDENCE = 0.6; // §1.2: below this the app shows the top choice + one alternative

const SYSTEM_PROMPT = `You classify a user's free-text capture into exactly one of their own life
domains and an entry type. Answer only from the capture text. Never store,
reference, or repeat personal information beyond what is needed for this
single response.`;

type Domain = { id: string; name: string; sort_order: number };

type Classification = {
  domain: string;
  alternative_domain: string | null;
  item_type: "task" | "note" | "prayer";
  title: string;
  due_date: string | null;
  confidence: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const mark = (k: string, from: number) => (timings[k] = Math.round(performance.now() - from));

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  let body: { text?: string; today?: string; domain_id?: string; item_type?: string; due_date?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return json({ error: "text required" }, 400);
  // The model has no clock: the app sends its local date so "next Tuesday" resolves
  // in the user's timezone; UTC is the fallback until profiles carry a timezone.
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);

  // --- domain list: the only thing the routing call waits on (§4.3 design rule)
  const tDb = performance.now();
  const { data: domains, error: domErr } = await supabase
    .from("domains")
    .select("id,name,sort_order")
    .is("archived_at", null)
    .order("sort_order");
  mark("db_domains_ms", tDb);
  if (domErr || !domains?.length) return json({ error: "no domains for user" }, 500);
  const byName = new Map<string, Domain>(domains.map((d: Domain) => [d.name, d]));

  // --- user re-route (US-03 low-confidence picker) or explicit manual filing
  if (body.domain_id) {
    const target = domains.find((d: Domain) => d.id === body.domain_id);
    if (!target) return json({ error: "unknown domain_id" }, 400);
    const itemType = body.item_type === "task" || body.item_type === "prayer" ? body.item_type : "note";
    const written = await writeItem(supabase, userId, target, {
      domain: target.name,
      alternative_domain: null,
      item_type: itemType,
      title: text,
      due_date: body.due_date ?? null,
      confidence: 1,
    }, text, "user");
    return json({ ...written, domain: target.name, domain_id: target.id, item_type: itemType,
      title: text, due_date: body.due_date ?? null, confidence: null, alternative: null,
      needs_confirmation: false, fallback: false, timings, latency_ms: Math.round(performance.now() - t0) });
  }

  // --- classify (Haiku, structured output; schema enum built per request — REQ-NF08)
  let result: Classification | null = null;
  let fallbackReason: string | null = null;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    fallbackReason = "ANTHROPIC_API_KEY not set";
  } else {
    const tClaude = performance.now();
    try {
      result = await classify(apiKey, domains.map((d: Domain) => d.name), text, today);
    } catch (e) {
      fallbackReason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    mark("claude_ms", tClaude);
  }

  // --- §6 fallback: primary domain (or first), flagged unsorted — never lose a capture
  if (!result) {
    const { data: profile } = await supabase.from("profiles").select("primary_domain_id").single();
    const target = domains.find((d: Domain) => d.id === profile?.primary_domain_id) ?? domains[0];
    const written = await writeItem(supabase, userId, target, {
      domain: target.name, alternative_domain: null, item_type: "note",
      title: text, due_date: null, confidence: 0,
    }, text, "fallback");
    console.log(JSON.stringify({ event: "route_capture.fallback", reason: fallbackReason, timings }));
    return json({ ...written, domain: target.name, domain_id: target.id, item_type: "note", title: text,
      due_date: null, confidence: 0, alternative: null, needs_confirmation: true, fallback: true,
      fallback_reason: fallbackReason, timings, latency_ms: Math.round(performance.now() - t0) });
  }

  const target = byName.get(result.domain) ?? domains[0];
  const alt = result.alternative_domain && result.alternative_domain !== target.name
    ? byName.get(result.alternative_domain) ?? null
    : null;
  const written = await writeItem(supabase, userId, target, result, text, "claude");
  const latency_ms = Math.round(performance.now() - t0);
  console.log(JSON.stringify({ event: "route_capture.ok", model: MODEL, confidence: result.confidence,
    item_type: result.item_type, timings, latency_ms }));
  return json({
    ...written,
    domain: target.name, domain_id: target.id,
    item_type: result.item_type, title: result.title, due_date: result.due_date,
    confidence: result.confidence,
    alternative: alt ? { domain: alt.name, domain_id: alt.id } : null,
    needs_confirmation: result.confidence < LOW_CONFIDENCE,
    fallback: false, timings, latency_ms,
  });
});

async function classify(apiKey: string, domainNames: string[], text: string, today: string): Promise<Classification> {
  const client = new Anthropic({ apiKey, timeout: 8_000, maxRetries: 1 });
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content:
        `Today is ${weekday} ${today}.\n` +
        `The user's domains are: ${domainNames.join(", ")}.\n` +
        `Classify this capture: "${text}"\n\n` +
        `domain: one name from the list. alternative_domain: next-best name, or null. ` +
        `item_type: task (actionable) | note (thought, reflection, information) | prayer (prayer request or spiritual intention). ` +
        `title: the capture lightly cleaned, under 12 words, keep the user's words. ` +
        `due_date: YYYY-MM-DD if the text names or clearly implies a date relative to today ("Friday", "next Tuesday", "tomorrow"), else null. ` +
        `confidence: 0.0–1.0; if nothing fits well, pick the closest and set it below 0.6.`,
    }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["domain", "alternative_domain", "item_type", "title", "due_date", "confidence"],
          properties: {
            domain: { type: "string", enum: domainNames },
            alternative_domain: { anyOf: [{ type: "string", enum: domainNames }, { type: "null" }] },
            item_type: { type: "string", enum: ["task", "note", "prayer"] },
            title: { type: "string" },
            due_date: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
            confidence: { type: "number" },
          },
        },
      },
    },
  });
  if (response.stop_reason === "refusal") throw new Error("classification refused");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text block in response");
  const parsed = JSON.parse(block.text) as Classification;
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  return parsed;
}

async function writeItem(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  domain: Domain,
  c: Classification,
  rawText: string,
  routedBy: "claude" | "user" | "fallback",
): Promise<{ table: "tasks" | "notes"; item_id: string }> {
  const confidence = routedBy === "user" ? null : c.confidence;
  if (c.item_type === "task") {
    const { data, error } = await supabase.from("tasks").insert({
      user_id: userId, domain_id: domain.id, title: c.title, status: "open",
      due_date: c.due_date, raw_capture: rawText, routed_by: routedBy, routing_confidence: confidence,
    }).select("id").single();
    if (error) throw new Error(`tasks insert failed: ${error.message}`);
    return { table: "tasks", item_id: data.id };
  }
  const { data, error } = await supabase.from("notes").insert({
    user_id: userId, domain_id: domain.id, item_type: c.item_type, content: c.title,
    raw_capture: rawText, routed_by: routedBy, routing_confidence: confidence,
  }).select("id").single();
  if (error) throw new Error(`notes insert failed: ${error.message}`);
  return { table: "notes", item_id: data.id };
}
