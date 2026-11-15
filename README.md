# AvoPore

**One membership for hands-on creative workshops.**

AvoPore gives members monthly tokens they can use to book pottery, cooking, photography, and other classes at independent studios. Studios choose which sessions and how many seats to offer. They can track attendance and see the payout calculated for each attendee.

[Open the live demo](https://avopore.vercel.app/discover?city=chicago) · [View a sample workshop](https://avopore.vercel.app/discover/pinch-pot-planters-chicago)

## Judge walkthrough

### Browse the live demo

Open **Workshops**, pick a state, and select **Show workshops**. Open a listing to see its dates, available seats, token price, and cancellation policy. The catalog includes a city in each of the **50 U.S. states** and **nine workshop categories**. It uses fictional studios and sample schedules. You can browse as a guest.

### Try the full booking flow locally

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
