import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

const methods = ["jazzcash", "easypaisa", "bank_transfer", "international"] as const;

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("withdrawal_requests").select("id,amount,currency,method,status,destination_label,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError("Could not load withdrawal requests.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!["freelancer", "provider", "agency"].includes(auth.role)) return jsonError("Only professional accounts can request a withdrawal.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const amount = numberField(body.amount);
  const method = textField(body.method, 30);
  if (amount === null || amount <= 0 || !methods.includes(method as (typeof methods)[number])) return jsonError("Enter a valid amount and payout method.");
  const { data, error } = await auth.supabase.from("withdrawal_requests").insert({ owner_id: auth.userId, amount, currency: "PKR", method: method as (typeof methods)[number], destination_label: textField(body.destination_label, 120) || null }).select().single();
  if (error) return jsonError("Could not create the request. No funds were transferred.", 400);
  revalidatePath(`/dashboard/${auth.role}/withdrawals`);
  return Response.json({ data, message: "Request recorded for admin review. No payment was sent." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return jsonError("Administrator access required.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const status = textField(body.status, 20);
  if (!id || !["processing", "paid", "rejected"].includes(status)) return jsonError("Choose a valid request status.");
  const nextStatus = status as "processing" | "paid" | "rejected";
  const { data, error } = await auth.supabase.from("withdrawal_requests").update({ status: nextStatus }).eq("id", id).select().single();
  if (error) return jsonError("Could not update the withdrawal request.", 400);
  return Response.json({ data, message: status === "paid" ? "Status marked paid. This action does not transfer funds." : undefined });
}
