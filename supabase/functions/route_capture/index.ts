// route_capture — REQ-F03/F04, US-03. Spec: vault AI_MANAGEMENT.md §1.2 (prompt),
// §2 (Haiku), §4.3 (2.2 s budget), §6 (fallback: never lose a capture).
// Auth: the caller's Supabase JWT is forwarded to supabase-js, so every read and
// write runs under the user's own RLS (REQ-NF07). Domains are read per request
// from the user's `domains` rows — never an enum (REQ-NF08).
//
// v4 (APP-049, REQ-F59): the Compounding Engine's first calibration loop. The
// low-confidence threshold is no longer a constant — it is read from the
// `assumptions` registry and recalibrated per user from their actual correction
// rate (routed_by='user' share, exponential smoothing per the Lagos mechanism),
// and the user's recent re-filings are fed to the classifier as examples so the
// router learns this user's patterns. Every response reports the calibration it
// used; the computed value is written back to the registry (own-rows RLS).
import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-4-5"; // AI_MANAGEMENT §2 — one constant, never scattered

// --- Compounding Engine calibration constants (REQ-F59 documents these) ---
const THRESHOLD_KEY = "routing.confidence_threshold";
const BASELINE_THRESHOLD = 0.6; // Day-0 default; also the lazy-seed fallback
const THRESHOLD_MAX = 0.9;      // picker must never demand near-certainty
const CORRECTION_GAIN = 0.5;    // target = baseline + gain * correction_rate
const SMOOTHING_ALPHA = 0.3;    // exponential smoothing toward the target
const CORRECTION_WINDOW_DAYS = 14;
const MAX_EXAMPLES = 3;         // corrected examples injected into the prompt

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

  // --- Compounding Engine: threshold + corrected examples (REQ-F59, APP-049)
  const tCal = performance.now();
  const calibration = await loadCalibration(supabase, domains);
  mark("db_calibration_ms", tCal);

  // --- classify (Haiku, structured output; schema enum built per request — REQ-NF08)
  let result: Classification | null = null;
  let fallbackReason: string | null = null;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    fallbackReason = "ANTHROPIC_API_KEY not set";
  } else {
    const tClaude = performance.now();
    try {
      result = await classify(apiKey, domains.map((d: Domain) => d.name), text, today, calibration.examples);
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
      fallback_reason: fallbackReason, calibration: calibration.report, timings,
      latency_ms: Math.round(performance.now() - t0) });
  }

  const target = byName.get(result.domain) ?? domains[0];
  const alt = result.alternative_domain && result.alternative_domain !== target.name
    ? byName.get(result.alternative_domain) ?? null
    : null;
  const written = await writeItem(supabase, userId, target, result, text, "claude");
  const latency_ms = Math.round(performance.now() - t0);
  console.log(JSON.stringify({ event: "route_capture.ok", model: MODEL, confidence: result.confidence,
    item_type: result.item_type, calibration: calibration.report, timings, latency_ms }));
  return json({
    ...written,
    domain: target.name, domain_id: target.id,
    item_type: result.item_type, title: result.title, due_date: result.due_date,
    confidence: result.confidence,
    alternative: alt ? { domain: alt.name, domain_id: alt.id } : null,
    needs_confirmation: result.confidence < calibration.threshold,
    fallback: false, calibration: calibration.report, timings, latency_ms,
  });
});

// --- Compounding Engine (APP-049 / REQ-F59) ------------------------------------
// Reads the user's threshold assumption + recent correction history, computes the
// effective threshold by exponential smoothing (the Lagos mechanism: prediction →
// actual → narrowed variance), writes the computed value back to the registry,
// and returns the user's recent re-filings as classifier examples. Every step is
// best-effort: a calibration failure must never block a capture (§6 spirit).

type CorrectedExample = { capture: string; domain: string; item_type: string };
type Calibration = {
  threshold: number;
  examples: CorrectedExample[];
  report: { threshold: number; baseline: number; correction_rate: number | null; corrected_examples: number };
};

// deno-lint-ignore no-explicit-any
async function loadCalibration(supabase: any, domains: Domain[]): Promise<Calibration> {
  const fallback: Calibration = {
    threshold: BASELINE_THRESHOLD,
    examples: [],
    report: { threshold: BASELINE_THRESHOLD, baseline: BASELINE_THRESHOLD, correction_rate: null, corrected_examples: 0 },
  };
  try {
    const cutoff = new Date(Date.now() - CORRECTION_WINDOW_DAYS * 86_400_000).toISOString();
    const byId = new Map<string, string>(domains.map((d) => [d.id, d.name]));

    const [assumptionQ, notesUserQ, tasksUserQ, notesAllQ, tasksAllQ] = await Promise.all([
      supabase.from("assumptions").select("id,value").eq("key", THRESHOLD_KEY).maybeSingle(),
      supabase.from("notes").select("raw_capture,content,item_type,domain_id,created_at")
        .eq("routed_by", "user").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(MAX_EXAMPLES),
      supabase.from("tasks").select("raw_capture,title,domain_id,created_at")
        .eq("routed_by", "user").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(MAX_EXAMPLES),
      supabase.from("notes").select("id", { count: "exact", head: true })
        .in("routed_by", ["user", "claude"]).gte("created_at", cutoff),
      supabase.from("tasks").select("id", { count: "exact", head: true })
        .in("routed_by", ["user", "claude"]).gte("created_at", cutoff),
      ]);

    // deno-lint-ignore no-explicit-any
    const userRows: any[] = [...(notesUserQ.data ?? []), ...(tasksUserQ.data ?? [])]
      // deno-lint-ignore no-explicit-any
      .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
    const routedTotal = (notesAllQ.count ?? 0) + (tasksAllQ.count ?? 0);
    const correctedTotal = userRows.length; // capped by MAX_EXAMPLES per table — a floor, honest enough
    const correctionRate = routedTotal > 0 ? Math.min(1, correctedTotal / routedTotal) : 0;

    const value = (assumptionQ.data?.value ?? {}) as { baseline?: number; computed?: number };
    const baseline = typeof value.baseline === "number" ? value.baseline : BASELINE_THRESHOLD;
    const prev = typeof value.computed === "number" ? value.computed : baseline;
    const target = Math.min(THRESHOLD_MAX, baseline + CORRECTION_GAIN * correctionRate);
    const computed = Math.round((SMOOTHING_ALPHA * target + (1 - SMOOTHING_ALPHA) * prev) * 100) / 100;

    if (assumptionQ.data?.id) {
      await supabase.from("assumptions").update({
        value: {
          ...value, baseline, computed,
          inputs: { corrected: correctedTotal, routed: routedTotal,
            correction_rate: Math.round(correctionRate * 100) / 100, window_days: CORRECTION_WINDOW_DAYS },
          computed_at: new Date().toISOString(),
        },
      }).eq("id", assumptionQ.data.id);
    }

    const examples: CorrectedExample[] = userRows.slice(0, MAX_EXAMPLES).map((r) => ({
      capture: String(r.raw_capture ?? r.content ?? r.title ?? "").slice(0, 140),
      domain: byId.get(r.domain_id) ?? "?",
      item_type: r.item_type ?? "task",
    })).filter((e: CorrectedExample) => e.capture && e.domain !== "?");

    return {
      threshold: computed,
      examples,
      report: { threshold: computed, baseline,
        correction_rate: Math.round(correctionRate * 100) / 100, corrected_examples: examples.length },
    };
  } catch (e) {
    console.log(JSON.stringify({ event: "route_capture.calibration_failed", reason: String(e) }));
    return fallback;
  }
}

async function classify(apiKey: string, domainNames: string[], text: string, today: string,
  examples: CorrectedExample[] = []): Promise<Classification> {
  const client = new Anthropic({ apiKey, timeout: 8_000, maxRetries: 1 });
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  // REQ-F59: the user's own re-filings teach the router this user's patterns.
  const exampleLines = examples.length
    ? `The user has previously re-filed these captures themselves — treat their choices as the ground truth for similar captures:\n` +
      examples.map((e) => `- "${e.capture}" → ${e.domain} (${e.item_type})`).join("\n") + "\n"
    : "";
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content:
        `Today is ${weekday} ${today}.\n` +
        `The user's domains are: ${domainNames.join(", ")}.\n` +
        exampleLines +
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
