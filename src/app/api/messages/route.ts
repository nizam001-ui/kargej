import { revalidatePath } from "next/cache";
import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation_id");
  if (!conversationId) return jsonError("conversation_id is required.");
  const { data, error } = await auth.supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
  if (error) return jsonError("Could not load messages.", 403);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const text = textField(body.body, 8000);
  const conversationId = textField(body.conversation_id, 80);
  if (!conversationId || text.length < 1) return jsonError("Write a message before sending it.");
  const { data, error } = await auth.supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: auth.userId,
    body: text,
  }).select().single();
  if (error) return jsonError("Could not send the message. Confirm you are in this conversation.", 403);
  await auth.supabase.from("conversations").update({ last_message_at: data.created_at }).eq("id", conversationId);
  revalidatePath("/dashboard/client/messages");
  revalidatePath("/dashboard/freelancer/messages");
  revalidatePath("/dashboard/provider/customer-messages");
  return Response.json({ data }, { status: 201 });
}
