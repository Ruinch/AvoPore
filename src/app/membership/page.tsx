import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { checkoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { isMembershipPlan, loginPath } from "@/lib/auth-navigation";
import { getBillingMode, renewalConsentText } from "@/lib/billing";
import { dollars } from "@/lib/catalog";
import { query } from "@/lib/db";
import { errorMessage } from "@/lib/messages";
import styles from "./membership.module.css";

export const metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

type Plan = { id: string; name: string; price_cents: number; tokens: number };

export default async function Membership({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [options, user, plans] = await Promise.all([
    searchParams,
    getCurrentUser(),
    query<Plan>("SELECT id, name, price_cents, tokens FROM public.plans ORDER BY price_cents"),
  ]);
  const billing = getBillingMode();
  const [subscription] = user?.role === "member" ? await query<{ id: string }>(
    "SELECT plan_id AS id FROM public.subscriptions WHERE member_id = $1 AND status IN ('active', 'ending', 'past_due') AND (period_end > now() OR status = 'past_due')",
    [user.id],
  ) : [];
  const selectedPlan = isMembershipPlan(options.plan) && !subscription ? options.plan : undefined;
  const visiblePlans = selectedPlan ? plans.toSorted((a, b) => Number(b.id === selectedPlan) - Number(a.id === selectedPlan)) : plans;
  const error = errorMessage(options.error);
  const canCheckout = billing !== "unavailable" && (!user || user.role === "member") && !subscription;

  return <section className={"shell " + styles.membership} aria-labelledby="membership-title">
    <header className={styles.header}>
      <div>
        <h1 className={styles.title} id="membership-title">Membership</h1>
        <p>Choose a monthly plan and spend your tokens on workshops at independent studios in participating cities.</p>
      </div>
      <Link className={"text-link " + styles.headerLink} href="/discover">
        Browse workshops <ArrowUpRight size={16} aria-hidden />
      </Link>
    </header>

    <div className={styles.statuses}>
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      {options.checkout === "cancelled" && <p role="status" className="notice">Checkout was cancelled. Choose a plan whenever you’re ready.</p>}
      {billing === "unavailable" && <p role="status" className="notice">Checkout is temporarily unavailable.</p>}
      {billing === "demo" && <p role="status" className="notice">In this demo, checkout adds tokens to your account at no cost.</p>}
      {billing !== "unavailable" && user && user.role !== "member" && <p className="notice">Use a member account to subscribe.</p>}
    </div>

    <section className={styles.plans} aria-label="Monthly plans">
      {visiblePlans.map((plan) => {
        const label = subscription?.id === plan.id ? "Your plan" : selectedPlan === plan.id ? "Selected plan" : null;
        return <article className={styles.plan} key={plan.id} data-highlighted={label !== null}>
          <div className={styles.planHeading}>
            <h2>{plan.name}</h2>
            {label && <span className={styles.planStatus}>{label}</span>}
          </div>
          <p className={styles.price}><strong>{dollars(plan.price_cents)}</strong><span> / month</span></p>
          <p className={styles.tokens}><strong>{plan.tokens}</strong> tokens per month</p>
          {canCheckout && (!user ? (
            <Link href={loginPath("/membership?plan=" + plan.id, { mode: "signup" })} className="button button-primary">
              Get started <ArrowUpRight size={16} aria-hidden />
            </Link>
          ) : (
            <form action={checkoutAction} className={styles.checkout}>
              <input type="hidden" name="plan" value={plan.id} />
              <label className="checkbox-line">
                <input type="checkbox" name="consent" required />
                <span>{renewalConsentText}</span>
              </label>
              <SubmitButton pendingText="Opening checkout…">
                {billing === "demo" ? "Simulate payment" : "Continue to Stripe"} <ArrowUpRight size={16} aria-hidden />
              </SubmitButton>
            </form>
          ))}
          {billing !== "unavailable" && subscription?.id === plan.id && (
            <Link href="/account" className="button button-secondary">
              View your membership <ArrowUpRight size={16} aria-hidden />
            </Link>
          )}
        </article>;
      })}
    </section>

    <section className={styles.terms} aria-labelledby="membership-terms">
      <h2 id="membership-terms">How tokens work</h2>
      <dl>
        <div>
          <dt>Access</dt>
          <dd>Every plan covers all workshop categories. Each session lists its token price before you book.</dd>
        </div>
        <div>
          <dt>Cancellation</dt>
          <dd>Cancel at least 24 hours before a workshop to receive your tokens back.</dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>Unused tokens expire at the end of each billing cycle. Your account shows your balance and expiry dates.</dd>
        </div>
      </dl>
    </section>
  </section>;
}
