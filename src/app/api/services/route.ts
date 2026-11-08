import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { services as demoServices } from "@/lib/data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city");
  const kind = url.searchParams.get("kind");
  const search = url.searchParams.get("q");
  if (!isSupabaseConfigured) {
    const data = demoServices.filter((item) => (!city || item.location === city) && (!kind || item.kind.toLowerCase() === kind) && (!search || `${item.title} ${item.seller} ${item.category} ${item.location}`.toLowerCase().includes(search.toLowerCase())));
    return Response.json({ data, demo: true });
  }
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  const userId = claims?.claims?.sub;
  const { data: profile } = typeof userId === "string" ? await client.from("profiles").select("role").eq("id", userId).maybeSingle() : { data: null };
  let query = client.from("services").select("*").order("created_at", { ascending: false }).limit(100);
  if (profile?.role !== "admin") query = query.eq("status", "active");
  if (city) query = query.eq("city", city);
  if (kind === "online" || kind === "local") query = query.eq("kind", kind);
  if (search) query = query.ilike("title", `%${search.replace(/[%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) return jsonError("Could not load services.", 500);
  return Response.json({ data });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return jsonError("Administrator access required.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const id = textField(body.id, 80);
  const status = textField(body.status, 20);
  if (!id || !["active", "paused", "rejected"].includes(status)) return jsonError("Choose a valid moderation status.");
  const nextStatus = status as "active" | "paused" | "rejected";
  const { data, error } = await auth.supabase.from("services").update({ status: nextStatus }).eq("id", id).select().single();
  if (error) return jsonError("Could not update the service status.", 400);
  revalidatePath("/explore");
  revalidatePath(`/services/${data.slug}`);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!["freelancer", "provider", "agency", "admin"].includes(auth.role)) return jsonError("Choose a professional account before creating a service.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const title = textField(body.title, 120);
  const description = textField(body.description, 5000);
  const price = numberField(body.price);
  const kind = body.kind === "local" ? "local" : "online";
  if (title.length < 5 || description.length < 20) return jsonError("Add a title and at least 20 characters describing your service.");
  if (price === null || price < 0) return jsonError("Enter a valid price in PKR.");
  if (kind === "local" && !textField(body.city, 80)) return jsonError("Choose a service city.");
  const slug = `${title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const categoryName = textField(body.category, 80);
  const { data: category } = categoryName ? await auth.supabase.from("categories").select("id").eq("name", categoryName).maybeSingle() : { data: null };
  const { data, error } = await auth.supabase.from("services").insert({
    seller_id: auth.userId,
    category_id: category?.id || null,
    title,
    slug,
    description,
    kind,
    price,
    currency: "PKR",
    delivery_days: numberField(body.delivery_days),
    city: kind === "local" ? textField(body.city, 80) : null,
    area: kind === "local" ? textField(body.area, 120) || null : null,
    cover_image_url: textField(body.cover_image_url, 800) || null,
    status: "pending",
  }).select().single();
  if (error) return jsonError("Could not save the service. Please try again.", 400);
  revalidatePath("/explore");
  revalidatePath(`/dashboard/${auth.role}/my-services`);
  return Response.json({ data }, { status: 201 });
}
