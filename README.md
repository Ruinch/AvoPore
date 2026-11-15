# AvoPore

AvoPore is a creative membership for in-person workshops at independent New York City studios. Members spend monthly tokens on classes. Studios manage sessions and mark attendance. An administrator can review bookings, return tokens, and calculate what each studio earned.

## Run locally

Use Node.js 22 or newer and npm. From the repository root run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. With no environment file, the app starts with a local PostgreSQL-compatible PGlite database and demo data. The demo account selector and simulated checkout let you exercise the workflow without provider accounts or Docker. Data persists on the local filesystem. Set `AVOPORE_DATA_DIR` in `.env.local` to an unused local directory to start with fresh demo data.

### Demo walkthrough

1. Sign in as the demo member and choose the Studio plan. The simulated checkout grants 24 tokens and the wallet shows their expiry date.
2. Open the catalog, filter by ceramics and choose three Wheel Throwing sessions at Clay House. A fresh demo includes one starting 30 minutes after setup, a second within 24 hours, and a third several days away. Each booking costs 8 tokens. Check the bookings and wallet balance in your account.
3. Cancel the session several days away and confirm the 8 tokens are returned. Cancel the second session, within the 24-hour window, and confirm the wallet balance stays at 8 tokens.
4. Sign in as the demo studio owner. Create a session and set its platform quota. Open the attendee list for the first Wheel Throwing session and check in the member. Check-in opens one hour before the session starts. If the seeded sessions have passed, create replacement sessions from the studio page.
5. Sign in as the demo admin. Verify that the attended booking generates an $18.00 studio payout, inspect the revenue per used token, and use the late-cancellation booking to try an audited refund.

### Checks

```sh
npm run typecheck
npm run test
npm run build
```

The integration tests use PGlite and the same database schema as the hosted app. Use the hosted service checklist below to verify provider credentials and delivery.

To run the built app locally in demo mode, set `AVOPORE_LOCAL_DEMO=1` and `AVOPORE_DEMO_SESSION_SECRET` to a random value in `.env.local`, then run `npm run start`. Run one local demo instance per data directory.

## Deploy a hosted test environment

The hosted MVP runs on Vercel with Supabase PostgreSQL and Auth, Stripe Checkout in test mode, and Resend for booking confirmations. Start with a dedicated Supabase project and a separate Stripe test environment.

1. Apply [`supabase/migrations/20261115000100_avopore.sql`](supabase/migrations/20261115000100_avopore.sql) to the Supabase project. In a demo deployment, also apply [`supabase/seed.sql`](supabase/seed.sql). Use the SQL Editor or your normal Supabase migration workflow.
2. In Supabase Auth, enable email sign-in, set the Site URL to the deployed app origin, and allow `https://<your-app>/auth/callback` in Redirect URLs. For Google, add the Supabase callback shown in the Google provider settings to the Google OAuth client, then enter the client ID and secret in Supabase. Configure custom SMTP to send confirmation emails to testers outside the Supabase project team. To support email confirmation in a different browser, set the Confirm Signup template link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo | urlquery }}`. [Supabase Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
3. Import the repository into Vercel using the Next.js preset. Set the variables below for the intended environment. Use the Supabase transaction pooler connection string and percent-encode reserved characters in the database password. The app verifies the database certificate and hostname on Vercel. If your project requires a dedicated CA, paste the PEM certificate from Supabase Database Settings into `SUPABASE_DB_CA_CERT` and omit SSL overrides from `DATABASE_URL` so the app can load it. [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase SSL configuration](https://supabase.com/docs/guides/platform/ssl-enforcement)
4. In Stripe Workbench for the same test environment as your API key, create an HTTPS snapshot event destination at `https://<your-app>/api/stripe/webhook` for `invoice.paid`, `customer.subscription.updated` and `customer.subscription.deleted`. Save the destination signing secret as `STRIPE_WEBHOOK_SECRET` and redeploy after changing it. Enable end-of-period cancellation in the test-mode customer portal. Keep the plan-switch setting off for this MVP. Create the test payment from AvoPore so the invoice is tied to an app member. [Stripe webhook setup](https://docs.stripe.com/webhooks) · [Stripe customer portal settings](https://docs.stripe.com/customer-management/configure-portal)
5. Verify a sender domain in Resend, set a sending key and an address on the verified domain in Vercel, and send a booking confirmation to a test recipient. The booking confirmation and the Supabase Auth confirmation are configured separately. [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction)
6. Confirm that the local walkthrough also passes on the deployed origin with a real test Checkout session. Inspect the Stripe event delivery, the token grant after payment, and the Resend delivery. Confirm that the Vercel production deployment shows a daily `/api/cron/expire` job. The app checks grant expiry during booking even if the daily job has yet to record the expiration. [Vercel cron scheduling and authorization](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)

To test real Stripe Checkout locally with a configured Stripe test environment, forward the destination events and use the CLI signing secret in `.env.local`:

```sh
stripe listen --events invoice.paid,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3000/api/stripe/webhook
```

For a hosted demo without Stripe credentials, leave both Stripe variables unset and explicitly set `AVOPORE_SIMULATE_PAYMENTS=1`. This path grants demo tokens without an external payment and is separate from the Stripe end-to-end test.

### Set up staff and admin identities

Create the accounts through Supabase Auth. New accounts get a member profile. Assign privileged accounts from the SQL Editor with their Auth user UUIDs. To find a studio UUID, run `select id, slug, name from public.studios order by name;`. Replace the placeholders below before running the relevant statements.

```sql
update public.profiles
set role = 'studio_owner', studio_id = '<studio-uuid>'
where id = '<studio-owner-auth-user-uuid>';

update public.profiles
set role = 'admin', studio_id = null
where id = '<admin-auth-user-uuid>';
```

Use `studio_staff` with a studio UUID for team members who only need staff access.

### Environment variables

| Variable | Hosted test value |
| --- | --- |
| `APP_URL` | Canonical public app origin, without a trailing slash |
| `DATABASE_URL` | Supabase PostgreSQL connection string, server only |
| `SUPABASE_DB_CA_CERT` | Optional PEM certificate for the database's CA, server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `STRIPE_SECRET_KEY` | Stripe test-mode API key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the configured Stripe event destination |
| `RESEND_API_KEY` | Server-side sending key |
| `RESEND_FROM_EMAIL` | Sender address on a verified Resend domain |
| `CRON_SECRET` | Random secret for the Vercel cron bearer token |

See [`.env.example`](.env.example) for a copyable template. Keep database, Stripe, Resend and cron secrets out of source control. Demo filesystem and session settings are local only.

## Architecture

| Area | Implementation |
| --- | --- |
| Web app | Next.js App Router with Tailwind components, member, studio and admin pages, plus server actions and integration endpoints |
| Identity | Supabase Auth in hosted mode, demo accounts in local mode, and role checks in the application |
| Catalog and inventory | Parameterized SQL through the PostgreSQL driver, with session-level limits on marketplace bookings |
| Booking and tokens | An append-only double-entry SQL ledger and atomic booking operations. A debit consumes the earliest-expiring eligible grant first. A booking stores the token price and payout rate at the time of purchase. |
| Billing | Stripe Checkout for subscriptions and signed invoice webhooks for token grants |
| Operations | Attendance and calculated payouts in the app, booking confirmation through Resend and token expiry through Vercel Cron |

New bookings and token movements share a database transaction. Cancellations release capacity and record ledger entries for eligible token refunds. The admin report multiplies recorded attendance by the corresponding booking rate and shows subscription revenue per token used.

The [U.S. pilot roadmap](docs/us-pilot-roadmap.md) contains the launch experiments, partner economics and the target architecture after the hackathon.
