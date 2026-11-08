import { revalidatePath } from "next/cache";
import { jsonError, readJson, requireUser, textField } from "@/lib/supabase/route-auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const [{ data, error }, { data: contact, error: contactError }] = await Promise.all([
    auth.supabase.from("profiles").select("id,full_name,role,username,bio,city,area,avatar_url,is_public,is_verified,created_at").eq("id", auth.userId).single(),
    auth.supabase.from("profile_contacts").select("phone").eq("profile_id", auth.userId).maybeSingle(),
  ]);
  if (error) return jsonError("Could not load your profile.", 500);
  if (contactError) return jsonError("Could not load your private profile details.", 500);
  return Response.json({ data: { ...data, phone: contact?.phone || null } });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");
  const fullName = textField(body.full_name, 100);
  if (fullName.length < 2) return jsonError("Your name must have at least 2 characters.");
  const phone = textField(body.phone, 20);
  if (phone && !/^\+92\s?3\d{2}\s?\d{7}$/.test(phone)) return jsonError("Use a Pakistan mobile number, such as +92 300 1234567.");
  const { data, error } = await auth.supabase.from("profiles").update({
    full_name: fullName,
    username: textField(body.username, 40).toLowerCase() || null,
    bio: textField(body.bio, 1200) || null,
    city: textField(body.city, 80) || null,
    area: textField(body.area, 120) || null,
    avatar_url: textField(body.avatar_url, 800) || null,
    is_public: body.is_public !== false,
  }).eq("id", auth.userId).select().single();
  if (error) return jsonError(error.code === "23505" ? "That username is already in use." : "Could not update your profile.", 400);
  const { error: contactError } = await auth.supabase.from("profile_contacts").upsert({ profile_id: auth.userId, phone: phone || null });
  if (contactError) return jsonError("Your profile was saved, but the private phone number could not be updated.", 400);
  revalidatePath(`/dashboard/${auth.role}/profile-settings`);
  revalidatePath(`/freelancers/${auth.userId}`);
  return Response.json({ data: { ...data, phone: phone || null } });
}
