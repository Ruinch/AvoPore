# AvoPore

**One membership for hands-on creative workshops.**

AvoPore gives members monthly tokens they can use to book pottery, cooking, photography, and other classes at independent studios. Studios choose which sessions and how many seats to offer. They can track attendance and see the payout calculated for each attendee.

[Try the live demo](https://avopore.vercel.app/login) · [View a sample workshop](https://avopore.vercel.app/discover/pinch-pot-planters-chicago)

## Judge walkthrough

### Try the member flow online

Use **Member demo** on the login page; you do not need to enter an email, password, or payment card. This button is available when the hosted deployment has demo payment simulation enabled. If it is missing, use the local demo below and check the [deployment guide](docs/deployment.md).

1. Open the [live demo](https://avopore.vercel.app/login) and choose **Member demo**.
2. In **Membership**, choose **Studio**, check the consent box, and select **Simulate payment** to add **24 test tokens** at no cost.
3. In **Workshops**, choose a state, select **Show workshops**, and book an upcoming session.
4. Open **My account** to see the booking and remaining balance. Cancel a session at least 24 hours before it starts to see its tokens return.

The [public catalog](https://avopore.vercel.app/discover?city=chicago) uses fictional studios and sample schedules, with a city in each of the **50 U.S. states** and **nine workshop categories**.

### Try studio and admin tools locally

With Node.js 22 or newer, run these commands in the repository root.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). A local database, workshop schedule, and demo accounts load automatically.

1. Select **Try the demo → Member demo**.
2. In **Membership**, choose **Studio**, check the consent box, and select **Simulate payment**. A fresh checkout adds **24 demo tokens** at no cost.
3. In **Workshops**, open an upcoming session and book a seat.
4. In **My account**, confirm the booking and the remaining balance. Cancel a booking at least 24 hours before it starts to see its tokens return.

Use **My account → Sign out** and return to **Try the demo** to try the other roles.

| Role | What to show |
| --- | --- |
| **Studio demo** | Publish a session, set how many seats AvoPore can book, and see the attendee list. Check-in opens one hour before the session starts. |
| **Admin demo** | Review bookings, issue a token refund, and see calculated studio payouts. Open **Owner** to review booking activity and export a studio CSV. |

If the local schedule has expired, set `AVOPORE_DATA_DIR=.avopore-data-fresh` in `.env.local` and restart. Use a directory you haven't used before to load fresh dates.

## Business model and pilot

Members buy a monthly token allowance. The planned Brooklyn pilot will test whether studios can fill quieter sessions at an agreed rate per attendee and whether members return for another workshop. We’ll measure repeat bookings, attendance, and margin after studio payouts. [U.S. pilot roadmap](docs/us-pilot-roadmap.md)

## Technical implementation

The app uses Next.js and TypeScript, with Supabase for hosted sign-in and PostgreSQL for data. The local demo uses PGlite, and the public demo runs on Vercel. Booking a seat and spending tokens happen in the same database transaction. Integration tests cover competition for the last seat, duplicate payment events, and refunds.

```sh
npm test
npm run typecheck
npm run build
```

[Deployment guide](docs/deployment.md) · [Environment template](.env.example) · [Integration tests](tests)
