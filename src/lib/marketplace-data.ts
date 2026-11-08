import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { professionals as demoProfessionals, services as demoServices } from "@/lib/data";
import type { Service } from "@/lib/data";

export type PublicProfessional = {
  slug: string;
  name: string;
  title: string;
  city: string;
  rating: string;
  reviews: number;
  rate: string;
  image: string;
  bio?: string | null;
  tags: string[];
};

export async function getPublishedServices(limit?: number): Promise<Service[]> {
  if (!isSupabaseConfigured) return demoServices.slice(0, limit);
  const supabase = await createClient();
  let query = supabase.from("services").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data: rows, error } = await query;
  if (error || !rows?.length) return [];

  const sellerIds = [...new Set(rows.map((row) => row.seller_id))];
  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))];
  const [{ data: sellerRows }, { data: categoryRows }, { data: reviewRows }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,city,avatar_url,role").in("id", sellerIds),
    categoryIds.length ? supabase.from("categories").select("id,name").in("id", categoryIds) : Promise.resolve({ data: [] }),
    supabase.from("reviews").select("service_id,rating").in("service_id", rows.map((row) => row.id)),
  ]);
  const sellers = new Map((sellerRows || []).map((item) => [item.id, item]));
  const categoryNames = new Map((categoryRows || []).map((item) => [item.id, item.name]));
  const ratings = new Map<string, number[]>();
  for (const review of reviewRows || []) {
    if (!review.service_id) continue;
    ratings.set(review.service_id, [...(ratings.get(review.service_id) || []), review.rating]);
  }
  return rows.map((row) => {
    const seller = sellers.get(row.seller_id);
    const serviceRatings = ratings.get(row.id) || [];
    const avg = serviceRatings.length ? serviceRatings.reduce((sum, value) => sum + value, 0) / serviceRatings.length : 0;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category_id ? categoryNames.get(row.category_id) || "Services" : "Services",
      seller: seller?.full_name || "Kárgéj professional",
      sellerSlug: row.seller_id,
      location: row.city || seller?.city || "Balochistan",
      price: Number(row.price),
      rating: avg ? avg.toFixed(1) : "New",
      reviews: serviceRatings.length,
      image: row.cover_image_url || "photo-1523726491678-bf852e717f6a",
      kind: row.kind === "local" ? "Local" : "Online",
    } satisfies Service;
  });
}

export async function getDashboardRows(userId: string, role: "client" | "freelancer" | "provider" | "agency" | "admin") {
  const supabase = await createClient();
  const result: string[] = [];
  const appendBookings = async (bookingRows: { status: string; service_id: string | null }[] | null) => {
    const serviceIds = [...new Set((bookingRows || []).map((booking) => booking.service_id).filter((id): id is string => Boolean(id)))];
    const { data: serviceRows } = serviceIds.length
      ? await supabase.from("services").select("id,title").in("id", serviceIds)
      : { data: [] };
    const titles = new Map((serviceRows || []).map((service) => [service.id, service.title]));
    for (const booking of bookingRows || []) result.push(`${booking.service_id ? titles.get(booking.service_id) || "Service booking" : "Project booking"} · ${booking.status.replaceAll("_", " ")}`);
  };
  if (role === "admin") {
    const { data } = await supabase.from("profiles").select("full_name,role,city,created_at").order("created_at", { ascending: false }).limit(8);
    for (const row of data || []) result.push(`${row.full_name || "New member"} · ${row.role} · ${row.city || "Balochistan"}`);
  } else if (role === "client") {
    const [{ data: projects }, { data: bookings }] = await Promise.all([
      supabase.from("projects").select("title,status,city,created_at").eq("client_id", userId).order("created_at", { ascending: false }).limit(6),
      supabase.from("bookings").select("status,service_id,created_at").eq("client_id", userId).order("created_at", { ascending: false }).limit(6),
    ]);
    for (const row of projects || []) result.push(`${row.title} · ${row.status.replaceAll("_", " ")}`);
    await appendBookings(bookings);
  } else {
    const ownerField = "provider_id" as const;
    const [{ data: listings }, { data: bookings }] = await Promise.all([
      supabase.from("services").select("title,status,created_at").eq("seller_id", userId).order("created_at", { ascending: false }).limit(6),
      supabase.from("bookings").select("status,service_id,created_at").eq(ownerField, userId).order("created_at", { ascending: false }).limit(6),
    ]);
    for (const row of listings || []) result.push(`${row.title} · ${row.status.replaceAll("_", " ")}`);
    await appendBookings(bookings);
  }
  return result.slice(0, 8);
}

export async function getDashboardStats(userId: string, role: "client" | "freelancer" | "provider" | "agency" | "admin") {
  const supabase = await createClient();
  if (role === "admin") {
    const [{ count: users }, { count: verifications }, { count: servicesCount }, { count: disputes }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
    ]);
    return [["Marketplace users", String(users ?? 0), "From Supabase"], ["Open verifications", String(verifications ?? 0), "Needs review"], ["Active services", String(servicesCount ?? 0), "Across Balochistan"], ["Disputes to resolve", String(disputes ?? 0), "Open cases"]] as [string, string, string][];
  }
  if (role === "client") {
    const [{ count: projects }, { count: bookings }, { count: saved }, { data: projectRows }] = await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", userId).in("status", ["open", "in_progress"]),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("client_id", userId).in("status", ["requested", "confirmed", "in_progress"]),
      supabase.from("saved_professionals").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id").eq("client_id", userId),
    ]);
    const ids = (projectRows || []).map((project) => project.id);
    const { count: proposals } = ids.length ? await supabase.from("proposals").select("id", { count: "exact", head: true }).in("project_id", ids).eq("status", "sent") : { count: 0 };
    return [["Active projects", String(projects ?? 0), "In your workspace"], ["Open proposals", String(proposals ?? 0), "Awaiting your review"], ["Upcoming bookings", String(bookings ?? 0), "Requested or confirmed"], ["Saved professionals", String(saved ?? 0), "In your shortlist"]] as [string, string, string][];
  }
  const [{ count: servicesCount }, { count: proposals }, { count: bookings }, { count: reviews }] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("seller_id", userId).neq("status", "rejected"),
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("freelancer_id", userId).eq("status", "sent"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("provider_id", userId).in("status", ["requested", "confirmed", "in_progress"]),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("professional_id", userId),
  ]);
  return [["My services", String(servicesCount ?? 0), "Saved in your account"], ["Open proposals", String(proposals ?? 0), "Awaiting a response"], ["Upcoming work", String(bookings ?? 0), "Requested or confirmed"], ["Client reviews", String(reviews ?? 0), "Published feedback"]] as [string, string, string][];
}

export async function getPublicProfessionals(limit = 3): Promise<PublicProfessional[]> {
  if (!isSupabaseConfigured) return demoProfessionals.slice(0, limit);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,city,bio,avatar_url")
    .eq("is_public", true)
    .in("role", ["freelancer", "provider", "agency"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !rows?.length) return [];
  const { data: reviewRows } = await supabase.from("reviews").select("professional_id,rating").in("professional_id", rows.map((row) => row.id));
  return rows.map((row) => {
    const feedback = (reviewRows || []).filter((review) => review.professional_id === row.id);
    const avg = feedback.length ? feedback.reduce((sum, review) => sum + review.rating, 0) / feedback.length : 0;
    return {
      slug: row.id,
      name: row.full_name || "Kárgéj professional",
      title: row.role === "provider" ? "Local service professional" : row.role === "agency" ? "Creative agency" : "Independent professional",
      city: row.city || "Balochistan",
      rating: avg ? avg.toFixed(1) : "New",
      reviews: feedback.length,
      rate: "Message for pricing",
      image: row.avatar_url || "photo-1534528741775-53994a69daeb",
      bio: row.bio,
      tags: row.role === "provider" ? ["Local services"] : ["Independent talent"],
    };
  });
}

export async function getPublicProfileById(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,full_name,role,city,bio,avatar_url,is_verified").eq("id", id).maybeSingle();
  return data;
}

export async function getPublicProfileBySlug(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const column = /^[0-9a-f-]{36}$/i.test(slug) ? "id" : "username";
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,role,city,bio,avatar_url,is_verified")
    .eq(column, slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!data) return null;
  const { data: reviews } = await supabase.from("reviews").select("rating").eq("professional_id", data.id);
  const feedback = reviews || [];
  const avg = feedback.length ? feedback.reduce((sum, review) => sum + review.rating, 0) / feedback.length : 0;
  return {
    slug: data.id,
    name: data.full_name,
    title: data.role === "provider" ? "Local service professional" : data.role === "agency" ? "Creative agency" : "Independent professional",
    city: data.city || "Balochistan",
    rating: avg ? avg.toFixed(1) : "New",
    reviews: feedback.length,
    rate: "Message for pricing",
    image: data.avatar_url || "photo-1534528741775-53994a69daeb",
    bio: data.bio,
    tags: data.role === "provider" ? ["Local services"] : ["Independent talent"],
  };
}

export async function getPublicServiceBySlug(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("slug", slug).eq("status", "active").maybeSingle();
  return data;
}
