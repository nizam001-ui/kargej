import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError("Could not load bookings.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "client") return jsonError("Only clients can request a booking.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const providerId = textField(body.provider_id, 80);
  const serviceId = textField(body.service_id, 80) || null;
  const projectId = textField(body.project_id, 80) || null;
  const amount = numberField(body.amount);
  if (!providerId || (!serviceId && !projectId) || amount === null || amount < 0) return jsonError("Choose a provider and service or project, and enter the agreed price.");
  const { data, error } = await auth.supabase.from("bookings").insert({
    client_id: auth.userId,
    provider_id: providerId,
    service_id: serviceId,
    project_id: projectId,
    amount,
    currency: "PKR",
    status: "requested",
    scheduled_at: textField(body.scheduled_at, 80) || null,
    city: textField(body.city, 80) || null,
    area: textField(body.area, 120) || null,
    address: textField(body.address, 300) || null,
  }).select().single();
  if (error) return jsonError("Could not request the booking. Check the service and provider.", 400);
  revalidatePath("/dashboard/client/bookings");
  revalidatePath("/dashboard/provider/upcoming-bookings");
  return Response.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const status = textField(body.status, 20);
  if (!id || !["confirmed", "in_progress", "completed", "cancelled"].includes(status)) return jsonError("Choose a valid booking update.");
  if (auth.role === "client" && status !== "cancelled") return jsonError("Clients can cancel a request; the professional updates work status.", 403);
  if (auth.role === "provider" && status === "cancelled") return jsonError("Contact the client to cancel this booking.", 403);
  if (!["client", "provider", "admin"].includes(auth.role)) return jsonError("This account cannot update bookings.", 403);
  const nextStatus = status as "confirmed" | "in_progress" | "completed" | "cancelled";
  const { data, error } = await auth.supabase.from("bookings").update({ status: nextStatus }).eq("id", id).select().single();
  if (error) return jsonError("Could not update this booking. Check that you are a booking participant.", 403);
  revalidatePath("/dashboard/client/bookings");
  revalidatePath("/dashboard/provider/upcoming-bookings");
  revalidatePath("/dashboard/provider/active-jobs");
  return Response.json({ data });
}
