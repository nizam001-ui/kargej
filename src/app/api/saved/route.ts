import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("saved_professionals").select("id,professional_id,created_at").order("created_at", { ascending: false });
  if (error) return jsonError("Could not load saved professionals.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const professionalId = textField(body.professional_id, 80);
  if (!professionalId || professionalId === auth.userId) return jsonError("Choose a valid professional.");
  const { data, error } = await auth.supabase.from("saved_professionals").upsert({ user_id: auth.userId, professional_id: professionalId }, { onConflict: "user_id,professional_id" }).select().single();
  if (error) return jsonError("Could not save this professional.", 400);
  return Response.json({ data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const professionalId = textField(body.professional_id, 80);
  const { error } = await auth.supabase.from("saved_professionals").delete().eq("user_id", auth.userId).eq("professional_id", professionalId);
  if (error) return jsonError("Could not remove this professional.", 400);
  return Response.json({ ok: true });
}
