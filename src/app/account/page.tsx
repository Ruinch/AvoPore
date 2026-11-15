import { ArrowUpRight, CalendarDays, Ticket } from "lucide-react";
import Link from "next/link";
import { billingPortalAction, cancelAction, logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { canManageBilling } from "@/lib/billing";
import { formatDay, formatTime } from "@/lib/catalog";
import { query, rpc } from "@/lib/db";
import { errorMessage } from "@/lib/messages";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

type Booking = { id: string; title: string; studio_name: string; studio_city: string; starts_at: Date | string; timezone: string; status: string; tokens_charged: number; refunded_tokens: number };
type Activity = { id: string | number; amount: number; reason: string; created_at: Date | string };
type Subscription = { name: string; status: string; period_end: Date | string; stripe_customer_id: string | null };
type Grant = { expires_at: Date | string; remaining: number };

const bookingLabel: Record<string, string> = { confirmed: "Confirmed", attended: "Attended", cancelled_free: "Cancelled", cancelled_late: "Late cancellation" };
const activityLabel: Record<string, string> = { issue: "Membership tokens", spend: "Workshop booking", refund: "Tokens returned", expire: "Tokens expired" };

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, options] = await Promise.all([requireUser(), searchParams]);
  if (user.role !== "member") return <section className="shell page-section">
    <div className="page-heading"><p className="eyebrow">AvoPore account</p><h1 className="display">Hi, {user.name.split(" ")[0]}.</h1><p>{user.email}</p></div>
    <div className="row-actions"><Link className="button button-primary" href={user.role === "admin" ? "/admin" : "/studio"}>Open dashboard <ArrowUpRight size={16} aria-hidden /></Link><form action={logoutAction}><SubmitButton secondary>Sign out</SubmitButton></form></div>
  </section>;

  const [balance, bookings, [subscription], activity, grants] = await Promise.all([
    rpc<number>("token_balance", { p_member_id: user.id }),
    query<Booking>(`SELECT b.id, t.title, st.name AS studio_name, st.city AS studio_city, s.starts_at, st.timezone, b.status, b.tokens_charged, b.refunded_tokens
      FROM public.bookings b JOIN public.sessions s ON s.id = b.session_id JOIN public.class_templates t ON t.id = s.template_id
      JOIN public.studios st ON st.id = t.studio_id WHERE b.member_id = $1 ORDER BY s.starts_at DESC LIMIT 60`, [user.id]),
    query<Subscription>(`SELECT p.name, sub.status, sub.period_end, sub.stripe_customer_id FROM public.subscriptions sub
      JOIN public.plans p ON p.id = sub.plan_id WHERE sub.member_id = $1`, [user.id]),
    query<Activity>(`SELECT e.id, e.amount, e.reason, e.created_at FROM public.ledger_entries e
      JOIN public.token_accounts a ON a.id = e.account_id WHERE a.member_id = $1 ORDER BY e.id DESC LIMIT 20`, [user.id]),
    query<Grant>(`SELECT g.expires_at, sum(e.amount)::int AS remaining FROM public.token_grants g
      JOIN public.ledger_entries e ON e.grant_id = g.id JOIN public.token_accounts a ON a.id = e.account_id
      WHERE g.member_id = $1 AND a.member_id = $1 AND g.expires_at > now()
      GROUP BY g.expires_at HAVING sum(e.amount) > 0 ORDER BY g.expires_at`, [user.id]),
  ]);
  const success = options.booking === "confirmed" ? "Your workshop is booked." : options.booking === "cancelled-free" ? "Booking cancelled. Your tokens have been returned." : options.booking === "cancelled-late" ? "Booking cancelled. The token refund deadline has passed." : options.checkout === "demo" ? "Demo payment complete. Your tokens are ready." : options.checkout === "success" ? "Checkout completed. Tokens appear when Stripe confirms the payment." : null;
  const error = errorMessage(options.error);
  return <section className="shell page-section">
    <div className="section-head account-heading"><div className="page-heading"><p className="eyebrow">My account</p><h1 className="display">Hi, {user.name.split(" ")[0]}.</h1><p>{user.email}</p></div><form action={logoutAction}><SubmitButton secondary>Sign out</SubmitButton></form></div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {success && <p role="status" className="notice">{success} {options.checkout === "success" && <Link href="/account" className="text-link">Refresh account</Link>}</p>}
    <div className="account-grid">
      <div className="account-main">
        <div className="section-head"><h2 className="display">My bookings</h2><Link href="/discover" className="text-link">Explore workshops <ArrowUpRight size={16} aria-hidden /></Link></div>
        {bookings.length ? <ul className="booking-list">{bookings.map((booking) => {
          const starts = new Date(booking.starts_at);
          const deadline = new Date(starts.valueOf() - 86_400_000);
          const canCancel = booking.status === "confirmed" && starts.valueOf() > Date.now();
          return <li key={booking.id} className="panel booking-record"><div className="record-top"><div><h3>{booking.title}</h3><p>{booking.studio_name} · {booking.studio_city}</p></div><span className="token-pill">{bookingLabel[booking.status] ?? booking.status}</span></div>
            <p className="record-date"><CalendarDays size={16} aria-hidden /> {formatDay(starts, booking.timezone)} · {formatTime(starts, booking.timezone, true)} · {booking.tokens_charged} tokens</p>
            {booking.refunded_tokens > 0 && <p className="muted">{booking.refunded_tokens} tokens returned</p>}
            {canCancel && <details className="cancel-details"><summary>Cancel booking</summary><p>{Date.now() <= deadline.valueOf() ? `Cancel by ${formatDay(deadline, booking.timezone)}, ${formatTime(deadline, booking.timezone, true)} for a full token refund.` : "The 24-hour deadline has passed. Cancelling will release your seat without a token refund."}</p><form action={cancelAction}><input type="hidden" name="booking" value={booking.id} /><SubmitButton secondary pendingText="Cancelling…">Confirm cancellation</SubmitButton></form></details>}
          </li>;
        })}</ul> : <p className="notice">Your workshop bookings will appear here.</p>}
      </div>
      <aside className="account-side">
        <div className="panel wallet"><p className="eyebrow">Token balance</p><p className="wallet-balance"><Ticket size={27} aria-hidden /> <strong>{balance}</strong> tokens</p>{grants.length > 0 && <ul className="expiry-list">{grants.map((grant) => <li key={new Date(grant.expires_at).toISOString()}>{grant.remaining} expire {formatDay(grant.expires_at)} at {formatTime(grant.expires_at, undefined, true)}</li>)}</ul>}
          {subscription && <p className="muted">{subscription.name} · {subscription.status === "ending" ? "Ends" : "Billing period ends"} {formatDay(subscription.period_end)} at {formatTime(subscription.period_end, undefined, true)}</p>}
          {canManageBilling(subscription?.stripe_customer_id) && <form action={billingPortalAction}><SubmitButton secondary>Manage membership <ArrowUpRight size={16} aria-hidden /></SubmitButton></form>}
          {(!subscription || subscription.status === "cancelled" || new Date(subscription.period_end).valueOf() <= Date.now()) && <Link className="button button-primary" href="/membership">Choose a plan <ArrowUpRight size={16} aria-hidden /></Link>}
        </div>
        <div className="panel activity"><h2>Recent token activity</h2>{activity.length ? <ul>{activity.map((entry) => <li key={entry.id}><div>{activityLabel[entry.reason] ?? entry.reason}<small>{formatDay(entry.created_at)}</small></div><strong>{entry.amount > 0 ? "+" : ""}{entry.amount}</strong></li>)}</ul> : <p className="muted">Charges and returns will appear here.</p>}</div>
      </aside>
    </div>
  </section>;
}
