import { revalidatePath } from "next/cache";
import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (error) return jsonError("Could not load conversations.", 500);
  const counterpartIds = [...new Set((data || []).map((item) => item.client_id === auth.userId ? item.professional_id : item.client_id))];
  const { data: profiles } = counterpartIds.length ? await auth.supabase.from("profiles").select("id,full_name,city,avatar_url").in("id", counterpartIds) : { data: [] };
  const names = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return Response.json({ data: (data || []).map((item) => ({ ...item, counterpart: names.get(item.client_id === auth.userId ? item.professional_id : item.client_id) || null })) });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  if (auth.role !== "client") return jsonError("Sign in with a client account to contact a professional.", 403);
  const recipientId = textField(body.professional_id, 80);
  const serviceId = textField(body.service_id, 80) || null;
  const projectId = textField(body.project_id, 80) || null;
  if (!recipientId || recipientId === auth.userId) return jsonError("Choose a valid professional.");
  const { data: recipient } = await auth.supabase.from("profiles").select("id,role,is_public").eq("id", recipientId).maybeSingle();
  if (!recipient || !recipient.is_public || !["freelancer", "provider", "agency"].includes(recipient.role)) return jsonError("This professional is not available for new conversations.", 404);
  if (serviceId) {
    const { data: service } = await auth.supabase.from("services").select("id").eq("id", serviceId).eq("seller_id", recipientId).eq("status", "active").maybeSingle();
    if (!service) return jsonError("This service is not available from that professional.", 404);
  }
  const existing = await auth.supabase.from("conversations").select("id").eq("client_id", auth.userId).eq("professional_id", recipientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.data) return Response.json({ data: existing.data });
  const { data, error } = await auth.supabase.from("conversations").insert({ client_id: auth.userId, professional_id: recipientId, service_id: serviceId, project_id: projectId }).select().single();
  if (error) return jsonError("Could not start this conversation. Sign in as a client to contact a professional.", 400);
  revalidatePath("/dashboard/client/messages");
  return Response.json({ data }, { status: 201 });
}
