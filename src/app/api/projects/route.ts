import { revalidatePath } from "next/cache";
import { jsonError, numberField, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return jsonError("Could not load projects.", 500);
  return Response.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.role !== "client" && auth.role !== "admin") return jsonError("Only client accounts can post projects.", 403);
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const title = textField(body.title, 120);
  const description = textField(body.description, 5000);
  const budgetMin = body.budget_min === "" || body.budget_min == null ? null : numberField(body.budget_min);
  const budgetMax = body.budget_max === "" || body.budget_max == null ? null : numberField(body.budget_max);
  if (title.length < 5 || description.length < 20) return jsonError("Add a title and at least 20 characters describing the project.");
  if ((body.budget_min != null && body.budget_min !== "" && budgetMin === null) || (body.budget_max != null && body.budget_max !== "" && budgetMax === null)) return jsonError("Enter a valid budget.");
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) return jsonError("Minimum budget must be less than maximum budget.");
  const categoryName = textField(body.category, 80);
  const { data: category } = categoryName ? await auth.supabase.from("categories").select("id").eq("name", categoryName).maybeSingle() : { data: null };
  const { data, error } = await auth.supabase.from("projects").insert({
    client_id: auth.userId,
    category_id: category?.id || null,
    title,
    description,
    budget_min: budgetMin,
    budget_max: budgetMax,
    currency: "PKR",
    city: textField(body.city, 80) || null,
    status: body.publish === true ? "open" : "draft",
  }).select().single();
  if (error) return jsonError("Could not save the project. Please try again.", 400);
  revalidatePath(`/dashboard/client/projects`);
  return Response.json({ data }, { status: 201 });
}
