import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const ownerId = new URL(request.url).searchParams.get("owner_id") || auth.userId;
  const { data, error } = await auth.supabase.from("portfolio_items").select("*").eq("owner_id", ownerId).order("sort_order", { ascending: true }).limit(100);
  if (error) return jsonError("Could not load portfolio items.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!["freelancer", "provider", "agency"].includes(auth.role)) return jsonError("Only professional accounts can add portfolio work.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const title = textField(body.title, 120);
  const mediaUrl = textField(body.media_url, 800);
  if (title.length < 3) return jsonError("Add a portfolio title.");
  if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) return jsonError("Portfolio media must use a secure HTTPS URL.");
  const { data, error } = await auth.supabase.from("portfolio_items").insert({ owner_id: auth.userId, title, description: textField(body.description, 1200) || null, media_url: mediaUrl || null, project_url: textField(body.project_url, 800) || null, sort_order: numberField(body.sort_order) || 0 }).select().single();
  if (error) return jsonError("Could not save portfolio item.", 400);
  revalidatePath(`/freelancers/${auth.userId}`);
  return Response.json({ data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const { error } = await auth.supabase.from("portfolio_items").delete().eq("id", id).eq("owner_id", auth.userId);
  if (error) return jsonError("Could not remove the portfolio item.", 400);
  return Response.json({ ok: true });
}
