import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("proposals").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError("Could not load proposals.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!["freelancer", "agency"].includes(auth.role)) return jsonError("Only freelance and agency accounts can send proposals.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const projectId = textField(body.project_id, 80);
  const coverLetter = textField(body.cover_letter, 5000);
  const amount = numberField(body.amount);
  const deliveryDays = numberField(body.delivery_days);
  if (!projectId || coverLetter.length < 30 || amount === null || amount <= 0 || deliveryDays === null || deliveryDays < 1) return jsonError("Add a detailed proposal, valid price, and delivery estimate.");
  const { data, error } = await auth.supabase.from("proposals").insert({ project_id: projectId, freelancer_id: auth.userId, cover_letter: coverLetter, amount, delivery_days: deliveryDays, currency: "PKR" }).select().single();
  if (error) return jsonError("Could not send the proposal. The project may be closed or already have your proposal.", 400);
  revalidatePath("/dashboard/freelancer/proposals");
  revalidatePath("/dashboard/client/proposals-received");
  return Response.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const status = textField(body.status, 20);
  if (!id || !["accepted", "rejected", "withdrawn"].includes(status)) return jsonError("Choose a valid proposal action.");
  if (status === "withdrawn" && !["freelancer", "agency"].includes(auth.role)) return jsonError("Only the proposer can withdraw a proposal.", 403);
  if (status !== "withdrawn" && auth.role !== "client" && auth.role !== "admin") return jsonError("Only the project owner can respond to a proposal.", 403);
  const nextStatus = status as "accepted" | "rejected" | "withdrawn";
  const { data, error } = await auth.supabase.from("proposals").update({ status: nextStatus }).eq("id", id).select().single();
  if (error) return jsonError("Could not update the proposal. Check that you are a project participant.", 403);
  if (nextStatus === "accepted") {
    await Promise.all([
      auth.supabase.from("projects").update({ status: "in_progress" }).eq("id", data.project_id),
      auth.supabase.from("proposals").update({ status: "rejected" }).eq("project_id", data.project_id).neq("id", id).eq("status", "sent"),
    ]);
  }
  revalidatePath("/dashboard/client/proposals-received");
  revalidatePath("/dashboard/freelancer/proposals");
  return Response.json({ data });
}
