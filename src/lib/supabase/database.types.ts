export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
type Timestamped = { id: string; created_at: string; updated_at: string };

export type ProfileRow = Timestamped & {
  full_name: string;
  role: "client" | "freelancer" | "provider" | "agency" | "admin";
  username: string | null;
  bio: string | null;
  city: string | null;
  area: string | null;
  avatar_url: string | null;
  is_public: boolean;
  is_verified: boolean;
};
export type ServiceRow = Timestamped & {
  seller_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  description: string;
  kind: "online" | "local";
  price: number;
  currency: string;
  delivery_days: number | null;
  city: string | null;
  area: string | null;
  status: "draft" | "pending" | "active" | "paused" | "rejected";
  cover_image_url: string | null;
};
export type ProjectRow = Timestamped & {
  client_id: string;
  category_id: string | null;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  city: string | null;
  status: "draft" | "open" | "in_progress" | "completed" | "cancelled";
  deadline: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      profile_contacts: Table<{ profile_id: string; phone: string | null; created_at: string; updated_at: string }>;
      categories: Table<Timestamped & { name: string; slug: string; description: string | null; is_active: boolean; sort_order: number }>;
      services: Table<ServiceRow>;
      service_media: Table<Timestamped & { service_id: string; owner_id: string; storage_path: string; alt_text: string | null; sort_order: number }>;
      projects: Table<ProjectRow>;
      proposals: Table<Timestamped & { project_id: string; freelancer_id: string; amount: number; currency: string; delivery_days: number; cover_letter: string; status: "sent" | "accepted" | "rejected" | "withdrawn" }>;
      bookings: Table<Timestamped & { client_id: string; provider_id: string; service_id: string | null; project_id: string | null; amount: number; currency: string; status: "requested" | "confirmed" | "in_progress" | "completed" | "cancelled"; scheduled_at: string | null; city: string | null; area: string | null; address: string | null }>;
      conversations: Table<Timestamped & { client_id: string; professional_id: string; service_id: string | null; project_id: string | null; booking_id: string | null; last_message_at: string | null }>;
      messages: Table<Timestamped & { conversation_id: string; sender_id: string; body: string; read_at: string | null }>;
      saved_professionals: Table<Timestamped & { user_id: string; professional_id: string }>;
      reviews: Table<Timestamped & { booking_id: string; author_id: string; professional_id: string; service_id: string | null; rating: number; comment: string | null }>;
      transactions: Table<Timestamped & { booking_id: string | null; project_id: string | null; payer_id: string; payee_id: string; amount: number; currency: string; payment_method: "jazzcash" | "easypaisa" | "bank_transfer" | "international" | null; provider_reference: string | null; status: "pending" | "authorized" | "paid" | "refunded" | "failed" }>;
      withdrawal_requests: Table<Timestamped & { owner_id: string; amount: number; currency: string; method: string; status: "requested" | "processing" | "paid" | "rejected"; destination_label: string | null }>;
      notifications: Table<Timestamped & { user_id: string; title: string; body: string; href: string | null; read_at: string | null }>;
      verification_requests: Table<Timestamped & { user_id: string; document_path: string | null; note: string | null; status: "pending" | "approved" | "rejected"; reviewed_by: string | null; reviewed_at: string | null }>;
      disputes: Table<Timestamped & { booking_id: string | null; project_id: string | null; opened_by: string; reason: string; details: string; status: "open" | "under_review" | "resolved" | "closed"; resolution: string | null }>;
      agencies: Table<Timestamped & { owner_id: string; name: string; slug: string; description: string | null; city: string | null; website_url: string | null }>;
      agency_members: Table<Timestamped & { agency_id: string; user_id: string; member_role: "owner" | "manager" | "member" }>;
      service_areas: Table<Timestamped & { provider_id: string; city: string; area: string | null; radius_km: number | null }>;
      availability: Table<Timestamped & { provider_id: string; weekday: number; start_time: string; end_time: string; is_available: boolean }>;
      portfolio_items: Table<Timestamped & { owner_id: string; title: string; description: string | null; media_url: string | null; project_url: string | null; sort_order: number }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
