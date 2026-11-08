-- Kárgéj marketplace schema. Apply with `supabase db push` or the Supabase SQL editor.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

do $$ begin
  create type public.app_role as enum ('client', 'freelancer', 'provider', 'agency', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.service_kind as enum ('online', 'local');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.service_status as enum ('draft', 'pending', 'active', 'paused', 'rejected');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'client',
  username text unique,
  bio text,
  city text,
  area text,
  avatar_url text,
  is_public boolean not null default true,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
begin
  if requested_role not in ('client','freelancer','provider','agency') then requested_role := 'client'; end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), requested_role::public.app_role)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'::public.app_role);
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create table if not exists public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text not null default '',
  kind public.service_kind not null default 'online',
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'PKR',
  delivery_days integer check (delivery_days is null or delivery_days > 0),
  city text,
  area text,
  status public.service_status not null default 'draft',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_media (
  id uuid primary key default extensions.gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_id, storage_path)
);

create table if not exists public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text not null,
  budget_min numeric(12,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(12,2) check (budget_max is null or budget_max >= 0),
  currency char(3) not null default 'PKR',
  city text,
  status text not null default 'draft' check (status in ('draft','open','in_progress','completed','cancelled')),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create table if not exists public.proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'PKR',
  delivery_days integer not null check (delivery_days > 0),
  cover_letter text not null,
  status text not null default 'sent' check (status in ('sent','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, freelancer_id)
);

create table if not exists public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'PKR',
  status text not null default 'requested' check (status in ('requested','confirmed','in_progress','completed','cancelled')),
  scheduled_at timestamptz,
  city text,
  area text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> provider_id),
  check (service_id is not null or project_id is not null)
);

create table if not exists public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> professional_id)
);

create table if not exists public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 8000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_professionals (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, professional_id), check(user_id <> professional_id)
);

create table if not exists public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id, author_id)
);

create table if not exists public.transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  payee_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'PKR',
  payment_method text check (payment_method is null or payment_method in ('jazzcash','easypaisa','bank_transfer','international')),
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','authorized','paid','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (booking_id is not null or project_id is not null)
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'PKR',
  method text not null check (method in ('jazzcash','easypaisa','bank_transfer','international')),
  destination_label text,
  status text not null default 'requested' check (status in ('requested','processing','paid','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_path text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved','closed')),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (booking_id is not null or project_id is not null)
);

create table if not exists public.agencies (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  city text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  id uuid primary key default extensions.gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','manager','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id, user_id)
);

create table if not exists public.service_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  area text,
  radius_km integer check (radius_km is null or radius_km between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, city, area)
);

create table if not exists public.availability (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time), unique(provider_id, weekday, start_time)
);

create table if not exists public.portfolio_items (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  media_url text,
  project_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_public_search_idx on public.services(status, kind, city, category_id);
create index if not exists services_seller_idx on public.services(seller_id, status);
create index if not exists projects_client_idx on public.projects(client_id, status);
create index if not exists proposals_project_idx on public.proposals(project_id, status);
create index if not exists bookings_participants_idx on public.bookings(client_id, provider_id, status);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);
create index if not exists transactions_participants_idx on public.transactions(payer_id, payee_id, status);

do $$ declare t text; begin
  foreach t in array array['profiles','profile_contacts','categories','services','service_media','projects','proposals','bookings','conversations','messages','saved_professionals','reviews','transactions','withdrawal_requests','notifications','verification_requests','disputes','agencies','agency_members','service_areas','availability','portfolio_items'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.categories, public.services, public.service_media, public.reviews, public.agencies, public.service_areas, public.availability, public.portfolio_items to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, username, bio, city, area, avatar_url, is_public) on public.profiles to authenticated;
grant select, insert, update on public.profile_contacts to authenticated;
grant select, insert, update on public.categories, public.services, public.service_media, public.projects, public.proposals, public.bookings, public.conversations, public.messages, public.saved_professionals, public.reviews, public.transactions, public.withdrawal_requests, public.notifications, public.verification_requests, public.disputes, public.agencies, public.agency_members, public.service_areas, public.availability, public.portfolio_items to authenticated;
grant delete on public.service_media, public.saved_professionals, public.portfolio_items, public.service_areas, public.availability to authenticated;
grant delete on public.reviews to authenticated;

create policy profiles_read_public on public.profiles for select to anon, authenticated using (is_public or id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid()) or (select private.is_admin())) with check (id = (select auth.uid()) or (select private.is_admin()));
create policy profile_contacts_owner_read on public.profile_contacts for select to authenticated using (profile_id = (select auth.uid()) or (select private.is_admin()));
create policy profile_contacts_owner_insert on public.profile_contacts for insert to authenticated with check (profile_id = (select auth.uid()) or (select private.is_admin()));
create policy profile_contacts_owner_update on public.profile_contacts for update to authenticated using (profile_id = (select auth.uid()) or (select private.is_admin())) with check (profile_id = (select auth.uid()) or (select private.is_admin()));
create policy categories_read_active on public.categories for select to anon, authenticated using (is_active or (select private.is_admin()));
create policy categories_admin_write on public.categories for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy services_read_live on public.services for select to anon, authenticated using (status = 'active' or seller_id = (select auth.uid()) or (select private.is_admin()));
create policy services_insert_owner on public.services for insert to authenticated with check (seller_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('freelancer','provider','agency')));
create policy services_update_owner on public.services for update to authenticated using (seller_id = (select auth.uid()) or (select private.is_admin())) with check (seller_id = (select auth.uid()) or (select private.is_admin()));
create policy services_delete_owner on public.services for delete to authenticated using (seller_id = (select auth.uid()) or (select private.is_admin()));
create policy media_read_live on public.service_media for select to anon, authenticated using (exists(select 1 from public.services s where s.id = service_id and (s.status = 'active' or s.seller_id = (select auth.uid()) or (select private.is_admin()))));
create policy media_insert_owner on public.service_media for insert to authenticated with check (owner_id = (select auth.uid()) and exists(select 1 from public.services s where s.id = service_id and s.seller_id = (select auth.uid())));
create policy media_update_owner on public.service_media for update to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin())) with check (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy media_delete_owner on public.service_media for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin()));

create policy projects_read_member on public.projects for select to authenticated using (status = 'open' or client_id = (select auth.uid()) or exists(select 1 from public.proposals p where p.project_id = id and p.freelancer_id = (select auth.uid())) or (select private.is_admin()));
create policy projects_insert_client on public.projects for insert to authenticated with check (client_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'client'));
create policy projects_update_owner on public.projects for update to authenticated using (client_id = (select auth.uid()) or (select private.is_admin())) with check (client_id = (select auth.uid()) or (select private.is_admin()));
create policy projects_delete_owner on public.projects for delete to authenticated using (client_id = (select auth.uid()) or (select private.is_admin()));
create policy proposals_read_members on public.proposals for select to authenticated using (freelancer_id = (select auth.uid()) or exists(select 1 from public.projects p where p.id = project_id and p.client_id = (select auth.uid())) or (select private.is_admin()));
create policy proposals_insert_freelancer on public.proposals for insert to authenticated with check (freelancer_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('freelancer','agency')) and exists(select 1 from public.projects p where p.id = project_id and p.status = 'open'));
create policy proposals_update_members on public.proposals for update to authenticated using (freelancer_id = (select auth.uid()) or exists(select 1 from public.projects p where p.id = project_id and p.client_id = (select auth.uid())) or (select private.is_admin())) with check (freelancer_id = (select auth.uid()) or exists(select 1 from public.projects p where p.id = project_id and p.client_id = (select auth.uid())) or (select private.is_admin()));
create policy proposals_delete_owner on public.proposals for delete to authenticated using (freelancer_id = (select auth.uid()) or (select private.is_admin()));

create policy bookings_read_participants on public.bookings for select to authenticated using (client_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select private.is_admin()));
create policy bookings_insert_client on public.bookings for insert to authenticated with check (client_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'client'));
create policy bookings_update_participants on public.bookings for update to authenticated using (client_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select private.is_admin())) with check (client_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select private.is_admin()));
create policy conversations_read_members on public.conversations for select to authenticated using (client_id = (select auth.uid()) or professional_id = (select auth.uid()) or (select private.is_admin()));
create policy conversations_insert_members on public.conversations for insert to authenticated with check (
  (client_id = (select auth.uid()) and exists(select 1 from public.profiles c where c.id = client_id and c.role = 'client') and exists(select 1 from public.profiles p where p.id = professional_id and p.is_public and p.role in ('freelancer','provider','agency')))
  or (professional_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = professional_id and p.role in ('freelancer','provider','agency')) and exists(select 1 from public.profiles c where c.id = client_id and c.role = 'client'))
);
create policy conversations_update_members on public.conversations for update to authenticated using (client_id = (select auth.uid()) or professional_id = (select auth.uid()) or (select private.is_admin())) with check (client_id = (select auth.uid()) or professional_id = (select auth.uid()) or (select private.is_admin()));
create policy messages_read_members on public.messages for select to authenticated using (exists(select 1 from public.conversations c where c.id = conversation_id and (c.client_id = (select auth.uid()) or c.professional_id = (select auth.uid()))) or (select private.is_admin()));
create policy messages_insert_sender on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists(select 1 from public.conversations c where c.id = conversation_id and (c.client_id = (select auth.uid()) or c.professional_id = (select auth.uid()))));
create policy saved_read_owner on public.saved_professionals for select to authenticated using (user_id = (select auth.uid()));
create policy saved_insert_owner on public.saved_professionals for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_update_owner on public.saved_professionals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_delete_owner on public.saved_professionals for delete to authenticated using (user_id = (select auth.uid()));
create policy reviews_read_public on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert_booking_client on public.reviews for insert to authenticated with check (author_id = (select auth.uid()) and exists(select 1 from public.bookings b where b.id = booking_id and b.client_id = (select auth.uid()) and b.provider_id = professional_id and b.status = 'completed'));

create policy transactions_read_parties on public.transactions for select to authenticated using (payer_id = (select auth.uid()) or payee_id = (select auth.uid()) or (select private.is_admin()));
create policy withdrawals_read_owner on public.withdrawal_requests for select to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy withdrawals_insert_owner on public.withdrawal_requests for insert to authenticated with check (owner_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('freelancer','provider','agency')));
create policy withdrawals_admin_update on public.withdrawal_requests for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy notifications_read_owner on public.notifications for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy notifications_update_owner on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy verification_read_owner_admin on public.verification_requests for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy verification_insert_owner on public.verification_requests for insert to authenticated with check (user_id = (select auth.uid()));
create policy verification_admin_update on public.verification_requests for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy disputes_read_parties on public.disputes for select to authenticated using (opened_by = (select auth.uid()) or exists(select 1 from public.bookings b where b.id = booking_id and (b.client_id = (select auth.uid()) or b.provider_id = (select auth.uid()))) or exists(select 1 from public.projects p where p.id = project_id and p.client_id = (select auth.uid())) or (select private.is_admin()));
create policy disputes_insert_participant on public.disputes for insert to authenticated with check (opened_by = (select auth.uid()) and (exists(select 1 from public.bookings b where b.id = booking_id and (b.client_id = (select auth.uid()) or b.provider_id = (select auth.uid()))) or exists(select 1 from public.projects p where p.id = project_id and p.client_id = (select auth.uid()))));
create policy disputes_admin_update on public.disputes for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy reviews_admin_update on public.reviews for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy reviews_admin_delete on public.reviews for delete to authenticated using ((select private.is_admin()));

create policy agencies_read_public on public.agencies for select to anon, authenticated using (true);
create policy agencies_insert_owner on public.agencies for insert to authenticated with check (owner_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'agency'));
create policy agencies_update_owner on public.agencies for update to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin())) with check (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy agency_members_read_member on public.agency_members for select to authenticated using (user_id = (select auth.uid()) or exists(select 1 from public.agencies a where a.id = agency_id and a.owner_id = (select auth.uid())) or (select private.is_admin()));
create policy agency_members_owner_write on public.agency_members for all to authenticated using (exists(select 1 from public.agencies a where a.id = agency_id and a.owner_id = (select auth.uid())) or (select private.is_admin())) with check (exists(select 1 from public.agencies a where a.id = agency_id and a.owner_id = (select auth.uid())) or (select private.is_admin()));
create policy service_areas_read_public on public.service_areas for select to anon, authenticated using (true);
create policy service_areas_owner_write on public.service_areas for all to authenticated using (provider_id = (select auth.uid()) or (select private.is_admin())) with check ((provider_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('provider','agency'))) or (select private.is_admin()));
create policy availability_read_public on public.availability for select to anon, authenticated using (true);
create policy availability_owner_write on public.availability for all to authenticated using (provider_id = (select auth.uid()) or (select private.is_admin())) with check ((provider_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('provider','agency'))) or (select private.is_admin()));
create policy portfolio_read_public on public.portfolio_items for select to anon, authenticated using (true);
create policy portfolio_owner_write on public.portfolio_items for all to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin())) with check ((owner_id = (select auth.uid()) and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('freelancer','provider','agency'))) or (select private.is_admin()));

insert into public.categories (name, slug, sort_order) values
  ('Design & creative','design',1),('Web & technology','technology',2),('Writing & translation','writing',3),
  ('Business & consulting','business',4),('Photo & video','photography',5),('Home & lifestyle','home-services',6)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-media', 'service-media', true, 8388608, array['image/jpeg','image/png','image/webp']),
  ('verification-documents', 'verification-documents', false, 12582912, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy service_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'service-media');
create policy service_media_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'service-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy service_media_owner_update on storage.objects for update to authenticated using (bucket_id = 'service-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))) with check (bucket_id = 'service-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy service_media_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'service-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy verification_documents_owner_read on storage.objects for select to authenticated using (bucket_id = 'verification-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
create policy verification_documents_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy verification_documents_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'verification-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare conversation_row public.conversations%rowtype; recipient uuid;
begin
  select * into conversation_row from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = conversation_row.client_id then conversation_row.professional_id else conversation_row.client_id end;
  insert into public.notifications (user_id, title, body, href)
  values (recipient, 'New message', left(new.body, 180), '/dashboard/' || (select role::text from public.profiles where id = recipient) || '/messages?conversation_id=' || new.conversation_id::text);
  return new;
end;
$$;
drop trigger if exists notify_on_message on public.messages;
create trigger notify_on_message after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.notify_new_proposal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_owner uuid;
begin
  select client_id into project_owner from public.projects where id = new.project_id;
  insert into public.notifications (user_id, title, body, href)
  values (project_owner, 'A new proposal arrived', 'A professional sent a proposal for your project.', '/dashboard/client/proposals-received');
  return new;
end;
$$;
drop trigger if exists notify_on_proposal on public.proposals;
create trigger notify_on_proposal after insert on public.proposals
for each row execute function public.notify_new_proposal();

create or replace function public.notify_new_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, href)
  values (new.provider_id, 'New booking request', 'A client requested a booking. Review the details in your dashboard.', '/dashboard/provider/upcoming-bookings');
  return new;
end;
$$;
drop trigger if exists notify_on_booking on public.bookings;
create trigger notify_on_booking after insert on public.bookings
for each row execute function public.notify_new_booking();

create or replace function public.notify_review_received()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, href)
  values (new.professional_id, 'You received a review', 'A client left feedback on completed work.', '/dashboard/freelancer/reviews');
  return new;
end;
$$;
drop trigger if exists notify_on_review on public.reviews;
create trigger notify_on_review after insert on public.reviews
for each row execute function public.notify_review_received();

create or replace function public.sync_verification_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    update public.profiles set is_verified = (new.status = 'approved') where id = new.user_id;
    insert into public.notifications (user_id, title, body, href)
    values (new.user_id, 'Verification request updated', 'Your profile verification request was ' || new.status || '.', '/dashboard/' || (select role::text from public.profiles where id = new.user_id) || '/profile-settings');
  end if;
  return new;
end;
$$;
drop trigger if exists sync_verification_request on public.verification_requests;
create trigger sync_verification_request after update of status on public.verification_requests
for each row execute function public.sync_verification_status();

-- Payment rows are created only by a trusted payment webhook/server integration.
-- Never expose a Supabase secret/service-role key to the browser.

