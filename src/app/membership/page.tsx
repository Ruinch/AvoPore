import { ArrowUpRight, Check, Ticket } from "lucide-react";
import Link from "next/link";
import { checkoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getBillingMode, renewalConsentText } from "@/lib/billing";
import { dollars } from "@/lib/catalog";
import { query } from "@/lib/db";
import { errorMessage } from "@/lib/messages";

export const metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

type Plan = { id: string; name: string; price_cents: number; tokens: number };

export default async function Membership({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [options, user, plans] = await Promise.all([
    searchParams, getCurrentUser(), query<Plan>("SELECT id, name, price_cents, tokens FROM public.plans ORDER BY price_cents"),
  ]);
  const billing = getBillingMode();
  const [subscription] = user?.role === "member" ? await query<{ id: string }>(`SELECT plan_id AS id FROM public.subscriptions WHERE member_id = $1 AND status IN ('active', 'ending', 'past_due') AND (period_end > now() OR status = 'past_due')`, [user.id]) : [];
  const error = errorMessage(options.error);
  return <section className="shell page-section">
    <div className="page-heading centered-heading"><p className="eyebrow">Monthly membership</p><h1 className="display">A little more making.</h1><p>Get tokens each month and use them for any available workshop. Choose the plan that fits how often you want to get into the studio.</p></div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {options.checkout === "cancelled" && <p role="status" className="notice">Checkout was cancelled. Choose a plan whenever you’re ready.</p>}
    {billing === "unavailable" && <p role="status" className="notice">Checkout is temporarily unavailable.</p>}
    {billing === "demo" && <p role="status" className="notice">Demo checkout simulates payment and adds tokens to your account.</p>}
    <div className="plan-grid">{plans.map((plan) => <article className={`panel plan-card ${plan.id === "studio" ? "plan-featured" : ""}`} key={plan.id}>
      <div className="plan-top"><h2>{plan.name}</h2>{subscription?.id === plan.id && <span className="token-pill">Your plan</span>}</div>
      <p className="plan-price"><strong>{dollars(plan.price_cents)}</strong> / month</p>
      <p className="plan-tokens"><Ticket size={21} aria-hidden /> {plan.tokens} tokens per billing cycle</p>
      <ul><li><Check size={16} aria-hidden /> Access to all studio categories</li><li><Check size={16} aria-hidden /> Free token returns 24+ hours before class</li></ul>
      {billing === "unavailable" ? null : !user ? <Link href="/login?mode=signup&next=/membership" className="button button-primary">Get started <ArrowUpRight size={16} aria-hidden /></Link> : user.role !== "member" ? <p className="muted">Use a member account to subscribe.</p> : subscription ? <Link href="/account" className="button button-secondary">View your membership <ArrowUpRight size={16} aria-hidden /></Link> : <form action={checkoutAction} className="form-stack">
        <input type="hidden" name="plan" value={plan.id} /><label className="checkbox-line"><input type="checkbox" name="consent" required /> <span>{renewalConsentText}</span></label>
        <SubmitButton pendingText="Opening checkout…">{billing === "demo" ? "Simulate payment" : "Continue to Stripe"} <ArrowUpRight size={16} aria-hidden /></SubmitButton>
      </form>}
    </article>)}</div>
    <p className="membership-policy">Unused subscription tokens expire at the end of each billing cycle. See your balance and expiry dates in your account.</p>
  </section>;
}
