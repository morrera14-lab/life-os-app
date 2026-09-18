// meeting_to_record — APP-056: meeting notes in → a PROPOSED Career outcome
// record out. Writes nothing (ADR-008 rule 2): the client shows the proposal
// and the user's confirm is the insert. The vault's meeting-notes-analyst
// shape (attendees / decisions / actions) becomes one outcome_records row —
// title, summary, occurred_on — plus the action list for the user to capture.
import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";

const MODEL = "claude-haiku-4-5";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  const { notes, today } = (await req.json()) as { notes?: string; today?: string };
  if (!notes?.trim()) return new Response(JSON.stringify({ error: "notes required" }), { status: 400 });
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });

  const anthropic = new Anthropic({ apiKey });
  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system:
      "You turn raw meeting notes into ONE structured career outcome record. Reply with JSON only, no prose: " +
      '{"title": string (<=90 chars, what the meeting achieved or decided), "summary": string (<=400 chars: decisions + why it matters, written as future evidence for a review), ' +
      '"occurred_on": "YYYY-MM-DD" (from the notes if stated, else today), "actions": string[] (each an owner-free imperative line, max 6)}. ' +
      `Today is ${today ?? "unknown"}. Never invent decisions not in the notes.`,
    messages: [{ role: "user", content: notes.slice(0, 8000) }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return new Response(JSON.stringify({ error: "could not structure those notes", raw: text.slice(0, 300) }), { status: 422 });
  }
  console.log(JSON.stringify({ event: "meeting_to_record.ok", model: MODEL, latency_ms: Date.now() - t0 }));
  return new Response(JSON.stringify({ proposal: parsed, latency_ms: Date.now() - t0 }), { status: 200, headers: { "Content-Type": "application/json" } });
});
