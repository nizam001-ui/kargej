import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return jsonError("Could not load notifications.", 500);
  return Response.json({ data });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  let query = auth.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.userId);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) return jsonError("Could not update notifications.", 400);
  return Response.json({ ok: true });
}
