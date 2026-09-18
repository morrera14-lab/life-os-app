// delete_account — the REQ-F70 right-to-erasure path (APP-021, GDPR Art. 17).
//
// Why an Edge Function: the anon-key client cannot delete its own auth.users
// row; only the service role can. This function verifies the caller's JWT,
// resolves THEIR user id from it (never from the request body — a caller can
// only ever delete themselves), and admin-deletes that auth user. Every app
// table references auth.users(id) on delete cascade (migrations 01–14), so
// this one delete erases profiles, domains, tasks, notes, habits, events,
// memory, agents, assumptions and consents in a single transaction.
//
// Deployed with verify_jwt: true — an unauthenticated call never reaches this
// code. The client double-confirms before calling (Settings → Delete my
// account & data).

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Resolve the caller from their own token — the only identity this function trusts.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
