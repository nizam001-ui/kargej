import { revalidatePath } from "next/cache";
import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("verification_requests").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError("Could not load verification requests.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const documentPath = textField(body.document_path, 500);
  const note = textField(body.note, 1000);
  if (documentPath && !documentPath.startsWith(`${auth.userId}/`)) return jsonError("Verification files must be stored in your private account folder.", 400);
  const { data, error } = await auth.supabase.from("verification_requests").insert({ user_id: auth.userId, document_path: documentPath || null, note: note || null }).select().single();
  if (error) return jsonError("Could not submit the verification request.", 400);
  revalidatePath("/dashboard/admin/verification-requests");
  return Response.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return jsonError("Administrator access required.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const status = textField(body.status, 20);
  if (!id || (status !== "approved" && status !== "rejected")) return jsonError("Choose approve or reject.");
  const { data, error } = await auth.supabase.from("verification_requests").update({ status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return jsonError("Could not update the verification request.", 400);
  revalidatePath("/dashboard/admin/verification-requests");
  return Response.json({ data });
}
