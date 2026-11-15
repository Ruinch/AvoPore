# Deploy AvoPore for testing

The hosted setup uses Vercel for the app, Supabase for PostgreSQL and sign-in, Stripe in test mode, and Resend for booking confirmations. Use a dedicated Supabase project and Stripe test environment. For the two-command local demo, see the [README](../README.md).

## 1. Set up the database

Apply the [schema migration](../supabase/migrations/20261115000100_avopore.sql) using the Supabase SQL Editor or your migration workflow. For a hosted demo, also apply the [demo seed](../supabase/seed.sql). You can reapply the seed to add Chicago and Los Angeles to an older hosted demo while preserving existing sessions and bookings.

## 2. Deploy on Vercel

Import the repository with the Next.js preset and use the [environment template](../.env.example) to set variables for the deployment.

| Service | Variables | Value |
| --- | --- | --- |
| App | `APP_URL` | Public HTTPS origin without a trailing slash |
| PostgreSQL | `DATABASE_URL`, `SUPABASE_DB_CA_CERT` | Supabase transaction pooler URL and optional CA certificate |
| Supabase Auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project URL and publishable key |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Test API key and destination signing secret |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Sending key and sender on a verified domain |
| Vercel Cron | `CRON_SECRET` | Random secret for the scheduled request |

Percent-encode reserved characters in the database password. The app verifies the database hostname and certificate. If the project requires a dedicated CA, use the PEM from Supabase Database Settings as `SUPABASE_DB_CA_CERT` and leave SSL overrides out of `DATABASE_URL`. Put server secrets in Vercel's environment settings. [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase SSL configuration](https://supabase.com/docs/guides/platform/ssl-enforcement)

## 3. Set up sign-in and test users

In Supabase Auth, enable email sign-in. Set **Site URL** to the deployed app origin and allow `https://<your-app>/auth/callback` in **Redirect URLs**. Configure custom SMTP for confirmation emails sent to testers outside the Supabase project team. [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

Use the following link in the **Confirm Signup** email template to allow confirmation from a different browser. [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo | urlquery }}
```

For optional Google sign-in, add the callback shown in Supabase to the Google OAuth client, then enter the client ID and secret in Supabase. [Supabase Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

Create test accounts through Supabase Auth. Each new account starts as a member. Assign studio and admin roles with their Auth user UUIDs. Find the studio UUID and replace the placeholders before running the relevant statement in the SQL Editor.

```sql
select id, slug, name from public.studios order by name;

update public.profiles
set role = 'studio_owner', studio_id = '<studio-uuid>'
where id = '<studio-owner-auth-user-uuid>';

update public.profiles
set role = 'admin', studio_id = null
where id = '<admin-auth-user-uuid>';
```

Use `studio_staff` with a studio UUID for the staff role.

## 4. Connect payments, email, and token expiry

- **Stripe.** In the same Stripe test environment as your API key, create an HTTPS snapshot event destination at `https://<your-app>/api/stripe/webhook` for `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`. Save the signing secret as `STRIPE_WEBHOOK_SECRET` and redeploy. In the test customer portal, enable end-of-period cancellation and leave plan switching disabled. [Stripe webhooks](https://docs.stripe.com/webhooks) · [Customer portal settings](https://docs.stripe.com/customer-management/configure-portal)
- **Resend.** Verify the sender domain, then set the sending key and sender email in Vercel. Resend sends booking confirmations. Supabase SMTP sends account confirmation emails. [Resend verified domains](https://resend.com/docs/dashboard/domains/introduction)
- **Cron.** Check the production deployment for the daily `/api/cron/expire` job defined in [`vercel.json`](../vercel.json). Booking checks token expiry immediately. The cron job records expirations in the ledger. [Vercel cron scheduling and authorization](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)

## 5. Verify the deployed app

1. Sign in with the test member and start Stripe Checkout from **Membership** so the test payment is tied to that member.
2. Confirm Stripe delivered `invoice.paid` and the token balance increased in **My account**.
3. Book an upcoming workshop and check the booking, the remaining token balance, and the Resend delivery.
4. Sign in with the studio test account to verify the attendee list and check-in. Then use the admin test account to verify the calculated payout. Use a booking more than 24 hours away to verify that cancelling returns its tokens.

For hosted checkout simulation, leave both Stripe variables unset and set `AVOPORE_SIMULATE_PAYMENTS=1`. Sign in through Supabase to use this mode.

## Optional local payment tests

For Stripe test payments on localhost, forward the events through the Stripe CLI and set the test API key and CLI signing secret in `.env.local`.

```sh
stripe listen --events invoice.paid,customer.subscription.updated,customer.subscription.deleted --forward-to http://127.0.0.1:3000/api/stripe/webhook
```

To run a local production build with demo accounts and simulated checkout, set `AVOPORE_LOCAL_DEMO=1` in `.env.local`, then run `npm run build` and `npm run start`. Set a random `AVOPORE_DEMO_SESSION_SECRET` if you want sign-in sessions to survive restarts. Run one local demo instance per data directory.
