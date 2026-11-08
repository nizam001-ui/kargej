import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const professionalId = new URL(request.url).searchParams.get("professional_id");
  let query = auth.supabase.from("reviews").select("id,professional_id,service_id,rating,comment,created_at,author_id").order("created_at", { ascending: false }).limit(100);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error) return jsonError("Could not load reviews.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "client") return jsonError("Only clients can review completed work.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const bookingId = textField(body.booking_id, 80);
  const rating = numberField(body.rating);
  const comment = textField(body.comment, 2000);
  if (!bookingId || rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5) return jsonError("Choose a booking and a rating from one to five.");
  const { data: booking } = await auth.supabase.from("bookings").select("id,provider_id,service_id,status").eq("id", bookingId).eq("client_id", auth.userId).maybeSingle();
  if (!booking || booking.status !== "completed") return jsonError("Reviews are available for completed bookings only.", 403);
  const { data, error } = await auth.supabase.from("reviews").insert({ booking_id: booking.id, author_id: auth.userId, professional_id: booking.provider_id, service_id: booking.service_id, rating, comment: comment || null }).select().single();
  if (error) return jsonError("A review may already exist for this booking.", 400);
  revalidatePath(`/freelancers/${booking.provider_id}`);
  revalidatePath(`/providers/${booking.provider_id}`);
  return Response.json({ data }, { status: 201 });
}
