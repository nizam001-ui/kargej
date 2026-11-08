import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function requireUser() {
  if (!isSupabaseConfigured) return { error: Response.json({ error: "Supabase is not configured. Add the project URL and publishable key to .env.local." }, { status: 503 }) } as const;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return { error: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id,role").eq("id", userId).maybeSingle();
  if (profileError || !profile) return { error: Response.json({ error: "Your account profile is not ready." }, { status: 403 }) } as const;
  return { supabase, userId, role: profile.role } as const;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function textField(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function numberField(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
