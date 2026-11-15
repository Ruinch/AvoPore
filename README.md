# AvoPore

AvoPore is a membership for in-person creative workshops. Members use monthly tokens to book classes at independent studios. The demo catalog includes a city in each of the 50 U.S. states, with fictional studios and bookable sample sessions.

## Run locally

Install Node.js 22 or newer with npm. From the repository root, run these two commands.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The local demo includes sample workshops, demo accounts, and simulated checkout. You can start without an environment file, Docker, or provider accounts.

## Try a booking

1. Select **Try the demo** in the header, then **Member demo**.
2. Open **Membership**, choose a plan, check the consent box, and select **Simulate payment**. If the demo member already has a plan, check their token balance in **My account**.
3. Open **Workshops**, choose a state and an upcoming date, then book a seat. Dates and times follow the studio's time zone.
4. Open **My account** to see the booking, remaining tokens, and expiry dates.

To switch roles, use **My account → Sign out** and return to **Try the demo**.

| Demo role | What to try |
| --- | --- |
| **Studio demo** | In **Studio**, publish a session, set the number of seats AvoPore can book, and open the attendee list. Check-in opens one hour before the session starts. |
| **Admin demo** | In **Admin**, review bookings, issue a token refund, or see calculated studio payouts. In **Owner**, view activity and download a studio CSV. |

## Demo data

The app saves local bookings and accounts in `.avopore-data`. To open a fresh demo while keeping existing data, set `AVOPORE_DATA_DIR=.avopore-data-fresh` in `.env.local` and restart the server. Choose a directory you haven't used before.

Seeded dates are relative to when the database was created. If they've passed, use **Studio demo** to publish a new session at Clay House in New York City, or open a fresh demo.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The tests use the project's SQL schema in a separate PGlite database.

## More about the project

- [Deployment guide](docs/deployment.md) for Vercel, Supabase, Stripe test payments, and email.
- [Environment template](.env.example) for local options and hosting.
- [U.S. pilot roadmap](docs/us-pilot-roadmap.md) for launch plans and studio economics.

The Next.js app lives in [`src/app`](src/app), with migrations and demo data in [`supabase`](supabase) and integration tests in [`tests`](tests).
