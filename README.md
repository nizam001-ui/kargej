# Kárgéj Marketplace

A Balochistan-first service marketplace built with Next.js App Router, TypeScript, Supabase Auth, and PostgreSQL. It includes public service discovery, account flows, role based dashboards, conversations, project and service workflows, and a Supabase migration with row-level security.

## Requirements

- Node.js 20.9 or later
- npm
- A Supabase project for live authentication and database features

## Run the frontend

```bash
npm install
npm run dev
```

Without Supabase credentials, public pages use the local sample catalog. Auth and writes show a setup message; protected dashboard routes are only enforced after Supabase is configured.

## Connect a Supabase project

1. Create a Supabase project and copy its Project URL and **publishable** key from the Connect/API Keys panel.
2. Copy `.env.example` to `.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. Restart `npm run dev` after changing environment variables.
4. Apply `supabase/migrations/202611030001_marketplace.sql` in the Supabase SQL editor, or use the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

5. In Supabase Auth URL Configuration, set your site URL to the deployed app and add redirect URLs for `/auth/callback` on localhost and your deployed domain. Enable email confirmations and configure SMTP before inviting real users.
6. Create the first admin account normally. Then promote its `profiles.role` to `admin` using the Supabase SQL editor. Never expose a service-role or secret key to the browser.

For local Supabase development, run `npx supabase start`, then `npx supabase db reset`. Local Auth emails are captured by the local Inbucket service.

## Supabase integration included

- Cookie backed Auth clients for browser, server components, API routes, and Next.js 16 Proxy session refresh.
- Signup, sign-in, sign-out compatible sessions, email verification callback, password recovery/update, and phone verification calls.
- PostgreSQL migration for profiles, categories, services/media, projects, proposals, bookings, conversations/messages, saved professionals, reviews, transactions, withdrawals, notifications, verification, disputes, agencies, service areas, availability, and portfolio items.
- Row-level security policies for ownership, participant access, public listings, and admin review actions.
- Server endpoints for projects, services, proposals, bookings, conversations/messages, saved professionals, profile updates, notifications, reviews, portfolio, and withdrawal requests.
- Public marketplace listings and professional cards load from Supabase when configured. Dashboard summary rows and metrics use account-scoped database data.

## Important payment limitation

The project stores PKR and payment method metadata but does not process money. No JazzCash, Easypaisa, bank, or international gateway has been configured. Withdrawal requests only record a request for admin review; marking a request paid does not transfer funds. Add and verify a merchant integration and signed webhook before enabling live payments or payouts. Financial records are write-protected from browser users in the included RLS policies.

## Routes

- Public: `/`, `/explore`, `/online-services`, `/local-services`, `/categories`, `/categories/[slug]`, `/services/[slug]`, `/freelancers/[slug]`, `/providers/[slug]`, `/agencies/[slug]`, `/pricing`, `/about`, `/how-it-works`, `/contact`, `/help`, `/terms`, `/privacy`
- Auth: `/login`, `/register`, `/register/role`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify-phone`, `/auth/callback`
- Dashboard: `/dashboard/client`, `/dashboard/freelancer`, `/dashboard/provider`, `/dashboard/admin`

The city catalog includes Quetta, Gwadar, Turbat, Khuzdar, Ziarat, Chaman, Sibi, Kalat, Pasni, Hub, Zhob, Loralai, Panjgur, Ormara, and Dera Murad Jamali. The homepage highlights Hanna Lake, Ziarat Juniper Forest, Gwadar waterfront, Kund Malir, Moola Chotok, and Hinglaj Mata Temple.

## Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## References

The interface adapts accessible, composable UI and dashboard patterns from [shadcn/ui](https://github.com/shadcn-ui/ui), [huuhabn/shadcn-admin-nextjs-starter](https://github.com/huuhabn/shadcn-admin-nextjs-starter), and [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter). No source files were copied from those repositories.
