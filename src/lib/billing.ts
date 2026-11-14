import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { type AppUser, resolveAppOrigin } from './auth';
import { isLocalDemo, query, rpc } from './db';

type Plan = { id: string; name: string; price_cents: number };
type Cycle = {
  memberId: string;
  planId: string;
  paymentRef: string;
  amountCents: number;
  startsAt: Date;
  endsAt: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};
type StripeSubscription = {
  id: string;
  status?: string;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
};
type StripeSubscriptionDetails = {
  subscription?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};
type StripeInvoiceLine = {
  period: { start: number; end: number };
  amount: number;
  type?: string;
  proration?: boolean;
  parent?: {
    subscription_item_details?: { subscription?: string | null; proration?: boolean } | null;
  } | null;
};
type StripeInvoice = {
  id: string;
  status: string;
  billing_reason?: string | null;
  currency: string;
  amount_paid: number;
  customer: string | { id: string } | null;
  parent?: { subscription_details?: StripeSubscriptionDetails | null } | null;
  subscription_details?: StripeSubscriptionDetails | null;
  subscription?: string | { id: string } | null;
  lines: { data: StripeInvoiceLine[] };
};
type StripeEvent = { type: string; livemode: boolean; data: { object: unknown } };
type StripeCheckout = { id: string; url: string | null; status: 'open' | 'complete' | 'expired' };
type CheckoutAttempt = { plan_id: string; session_ref: string; created_at: string | Date; stripe_session_id: string | null };

const stripeVersion = '2025-06-30.basil';
const stripeSource = 'avopore-membership-v1';
const checkoutMinutes = 35;
export const renewalConsentText = 'I agree that my membership renews monthly at the selected price until I cancel.';

class StripeApiError extends Error {
  constructor(readonly status: number, readonly parameter?: string) {
    super('Stripe could not complete the request. Please try again.');
  }
}

function testStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key && /^(sk|rk)_test_/.test(key) ? key : null;
}

export function getBillingMode(): 'demo' | 'stripe' | 'unavailable' {
  if (testStripeKey() && process.env.STRIPE_WEBHOOK_SECRET) return 'stripe';
  if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_WEBHOOK_SECRET) return 'unavailable';
  return isLocalDemo() || process.env.AVOPORE_SIMULATE_PAYMENTS === '1' ? 'demo' : 'unavailable';
}

async function stripeRequest<T>(path: string, fields?: Record<string, string>, idempotencyKey?: string) {
  const key = testStripeKey();
  if (!key) throw new Error('Stripe test billing is unavailable.');
  const headers = new Headers({ Authorization: `Bearer ${key}`, 'Stripe-Version': stripeVersion });
  if (fields) headers.set('Content-Type', 'application/x-www-form-urlencoded');
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  const response = await fetch(new URL(`/v1${path}`, 'https://api.stripe.com'), {
    method: fields ? 'POST' : 'GET',
    headers,
    body: fields ? new URLSearchParams(fields) : undefined,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    console.warn('Stripe API request failed', { status: response.status, request: response.headers.get('request-id') });
    const failure = await response.json().catch(() => null) as { error?: { param?: string } } | null;
    throw new StripeApiError(response.status, failure?.error?.param);
  }
  return await response.json() as T;
}

async function getPlan(id: string) {
  const [plan] = await query<Plan>('SELECT id, name, price_cents FROM public.plans WHERE id = $1', [id]);
  return plan ?? null;
}

async function authorizeCheckout(user: AppUser, planCode: string, accepted: boolean) {
  if (user.role !== 'member') throw new Error('Only members can subscribe.');
  if (!accepted) throw new Error('Confirm the monthly renewal terms to continue.');
  const plan = await getPlan(planCode);
  if (!plan) throw new Error('Choose an available membership.');
  return plan;
}

async function recordConsent(id: string, memberId: string, plan: Plan) {
  const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(plan.price_cents / 100);
  const text = `${renewalConsentText} ${plan.name} costs ${formattedPrice} per month.`;
  await query(`INSERT INTO public.consents (id, member_id, plan_id, version, consent_text)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`, [id, memberId, plan.id, '2026-11-mvp', text]);
}

function stripeRedirect(url: string | null, expectedOrigin: string) {
  if (!url || new URL(url).origin !== expectedOrigin) {
    throw new Error('Stripe did not return the expected link. Please try again.');
  }
  return url;
}

async function rotateCheckout(memberId: string, planId: string, previousRef: string) {
  const [rotated] = await query<CheckoutAttempt>(`
    UPDATE public.checkout_attempts
    SET plan_id = $2, session_ref = gen_random_uuid(), created_at = now(), stripe_session_id = NULL
    WHERE member_id = $1 AND session_ref = $3
    RETURNING plan_id, session_ref, created_at, stripe_session_id
  `, [memberId, planId, previousRef]);
  if (!rotated) throw new Error('Checkout changed. Try again.');
  return rotated;
}

async function reserveCheckout(memberId: string, planId: string) {
  const [inserted] = await query<CheckoutAttempt>(`
    INSERT INTO public.checkout_attempts (member_id, plan_id) VALUES ($1, $2)
    ON CONFLICT (member_id) DO NOTHING RETURNING plan_id, session_ref, created_at, stripe_session_id
  `, [memberId, planId]);
  if (inserted) return { attempt: inserted, existingUrl: null };

  const [previous] = await query<CheckoutAttempt>(`
    SELECT plan_id, session_ref, created_at, stripe_session_id FROM public.checkout_attempts WHERE member_id = $1
  `, [memberId]);
  if (!previous) throw new Error('Checkout changed. Try again.');

  if (previous.stripe_session_id) {
    const path = `/checkout/sessions/${encodeURIComponent(previous.stripe_session_id)}`;
    const session = await stripeRequest<StripeCheckout>(path);
    if (session.status === 'complete') throw new Error('Your payment is being confirmed. Check your account in a moment.');
    if (session.status === 'open' && previous.plan_id === planId) {
      return { attempt: previous, existingUrl: stripeRedirect(session.url, 'https://checkout.stripe.com') };
    }
    if (session.status === 'open') await stripeRequest(`${path}/expire`, {});
  } else if (Date.now() - new Date(previous.created_at).getTime() < checkoutMinutes * 60 * 1000) {
    if (previous.plan_id !== planId) throw new Error('Another checkout is opening. Try again in a moment.');
    return { attempt: previous, existingUrl: null };
  }

  return { attempt: await rotateCheckout(memberId, planId, previous.session_ref), existingUrl: null };
}

async function readCheckoutSubscription(memberId: string) {
  const [subscription] = await query<{ stripe_customer_id: string | null; open_cycle: boolean }>(`
    SELECT stripe_customer_id,
      (status IN ('active', 'ending', 'past_due') AND (period_end > now() OR status = 'past_due')) AS open_cycle
    FROM public.subscriptions WHERE member_id = $1
  `, [memberId]);
  if (subscription?.open_cycle) throw new Error('You already have a membership. Manage it from your account.');
  return subscription;
}

export async function createCheckout(user: AppUser, planCode: string, origin: string, renewalAccepted: boolean) {
  if (getBillingMode() !== 'stripe') throw new Error('Stripe test checkout is unavailable.');
  const plan = await authorizeCheckout(user, planCode, renewalAccepted);
  const url = resolveAppOrigin(origin);
  await readCheckoutSubscription(user.id);
  const { attempt, existingUrl } = await reserveCheckout(user.id, plan.id);
  const subscription = await readCheckoutSubscription(user.id);
  if (existingUrl) return existingUrl;
  const customerId = subscription?.stripe_customer_id;
  try {
    return await openCheckout(user, plan, url, attempt, customerId);
  } catch (error) {
    if (!(error instanceof StripeApiError) || error.status !== 400 || error.parameter !== 'expires_at') throw error;
    // Stripe rejected the request before creating a session. A network failure keeps the original key.
    const renewedAttempt = await rotateCheckout(user.id, plan.id, attempt.session_ref);
    return openCheckout(user, plan, url, renewedAttempt, customerId);
  }
}

async function openCheckout(user: AppUser, plan: Plan, url: string, attempt: CheckoutAttempt, customerId?: string | null) {
  const consentId = attempt.session_ref;
  await recordConsent(consentId, user.id, plan);
  const fields = {
    mode: 'subscription',
    success_url: `${url}/account?checkout=success`,
    cancel_url: `${url}/membership?checkout=cancelled`,
    expires_at: String(Math.floor(new Date(attempt.created_at).getTime() / 1000) + checkoutMinutes * 60),
    client_reference_id: user.id,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(plan.price_cents),
    'line_items[0][price_data][product_data][name]': `AvoPore ${plan.name}`,
    'line_items[0][price_data][recurring][interval]': 'month',
    'subscription_data[metadata][source]': stripeSource,
    'subscription_data[metadata][member_id]': user.id,
    'subscription_data[metadata][plan_id]': plan.id,
    'subscription_data[metadata][consent_id]': consentId,
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
  };
  const session = await stripeRequest<StripeCheckout>('/checkout/sessions', fields, `avopore-checkout-${consentId}`);
  await query(`UPDATE public.checkout_attempts SET stripe_session_id = $1 WHERE member_id = $2 AND session_ref = $3`,
    [session.id, user.id, attempt.session_ref]);
  return stripeRedirect(session.url, 'https://checkout.stripe.com');
}

export function canManageBilling(stripeCustomerId?: string | null) {
  return getBillingMode() === 'stripe' && Boolean(stripeCustomerId);
}

export async function createBillingPortal(user: AppUser, origin: string) {
  if (user.role !== 'member') throw new Error('Only members can manage a membership.');
  const [subscription] = await query<{ stripe_customer_id: string | null }>(`
    SELECT stripe_customer_id FROM public.subscriptions WHERE member_id = $1
  `, [user.id]);
  const customer = subscription?.stripe_customer_id;
  if (!customer || !canManageBilling(customer)) throw new Error('There is no Stripe membership to manage.');
  const session = await stripeRequest<{ url: string | null }>('/billing_portal/sessions', {
    customer, return_url: `${resolveAppOrigin(origin)}/account`,
  });
  return stripeRedirect(session.url, 'https://billing.stripe.com');
}

function oneCalendarMonthLater(startsAt: Date) {
  const end = new Date(startsAt);
  const originalDay = startsAt.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(originalDay, lastDay));
  return end;
}

async function issueCycle(input: Cycle) {
  return rpc<{ created: boolean; grant_id: string }>('issue_cycle', {
    p_member_id: input.memberId,
    p_plan_id: input.planId,
    p_payment_ref: input.paymentRef,
    p_amount_cents: input.amountCents,
    p_period_start: input.startsAt.toISOString(),
    p_period_end: input.endsAt.toISOString(),
    p_stripe_customer_id: input.stripeCustomerId ?? null,
    p_stripe_subscription_id: input.stripeSubscriptionId ?? null,
  });
}

export async function simulateCheckout(user: AppUser, planCode: string, renewalAccepted: boolean) {
  if (getBillingMode() !== 'demo') throw new Error('Simulated payments are unavailable.');
  const plan = await authorizeCheckout(user, planCode, renewalAccepted);
  const now = new Date();
  const paymentRef = `demo:${user.id}:${now.toISOString().slice(0, 7)}`;
  await recordConsent(randomUUID(), user.id, plan);
  await issueCycle({
    memberId: user.id, planId: plan.id, paymentRef, amountCents: plan.price_cents,
    startsAt: now, endsAt: oneCalendarMonthLater(now),
  });
}

export class StripeSignatureError extends Error {}

function stripeEvent(body: Buffer, signature: string): StripeEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !testStripeKey()) throw new Error('Stripe webhook is unavailable.');

  const parts = signature.split(',').map((entry) => entry.trim().split('=', 2));
  const timestamp = parts.find(([name]) => name === 't')?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new StripeSignatureError('Invalid Stripe event timestamp.');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest();
  const valid = parts.some(([name, value]) => name === 'v1' && /^[a-f0-9]{64}$/i.test(value ?? '')
    && timingSafeEqual(expected, Buffer.from(value, 'hex')));
  if (!valid) throw new StripeSignatureError('Invalid Stripe event signature.');

  let event: StripeEvent;
  try {
    event = JSON.parse(body.toString('utf8')) as StripeEvent;
  } catch {
    throw new StripeSignatureError('Invalid Stripe event body.');
  }
  if (event?.livemode !== false || typeof event.type !== 'string' || !event.data?.object) {
    throw new StripeSignatureError('A Stripe test event is required.');
  }
  return event;
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

async function handlePaidInvoice(invoice: StripeInvoice) {
  if (invoice.status !== 'paid' || !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')) return;
  const details = invoice.parent?.subscription_details ?? invoice.subscription_details;
  const subscriptionId = stripeId(details?.subscription ?? invoice.subscription);
  if (!subscriptionId) return;

  const metadata = details?.metadata?.source === stripeSource
    ? details.metadata
    : (await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)).metadata;
  if (metadata?.source !== stripeSource) return;
  const plan = await getPlan(metadata.plan_id);
  const [consent] = await query<{ id: string }>(`
    SELECT id FROM public.consents WHERE id = $1 AND member_id = $2 AND plan_id = $3
  `, [metadata.consent_id, metadata.member_id, metadata.plan_id]);
  if (!plan || !consent || invoice.currency !== 'usd' || invoice.amount_paid < plan.price_cents) {
    throw new Error('Paid invoice does not match a membership and renewal consent.');
  }

  const line = invoice.lines.data.find((item) => {
    const subscription = item.parent?.subscription_item_details;
    const belongsToSubscription = subscription
      ? subscription.subscription === subscriptionId && !subscription.proration
      : item.type === 'subscription' && !item.proration;
    return belongsToSubscription && item.amount === plan.price_cents;
  });
  const customerId = stripeId(invoice.customer);
  if (!line || !customerId || !Number.isSafeInteger(line.period?.start) || !Number.isSafeInteger(line.period?.end)
    || line.period.end <= line.period.start) throw new Error('Paid invoice has no valid billing period.');

  await issueCycle({
    memberId: metadata.member_id, planId: plan.id, paymentRef: invoice.id, amountCents: invoice.amount_paid,
    startsAt: new Date(line.period.start * 1000), endsAt: new Date(line.period.end * 1000),
    stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId,
  });
  await syncSubscription(subscriptionId, false);
  await query('DELETE FROM public.checkout_attempts WHERE member_id = $1 AND session_ref = $2',
    [metadata.member_id, metadata.consent_id]);
}

async function syncSubscription(subscriptionId: string, deleted: boolean) {
  const [known] = await query<{ member_id: string }>(`
    SELECT member_id FROM public.subscriptions WHERE stripe_subscription_id = $1
  `, [subscriptionId]);
  if (!known) return;
  const subscription = deleted ? null : await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  const status = deleted || ['canceled', 'incomplete_expired'].includes(subscription?.status ?? '') ? 'cancelled'
    : subscription?.cancel_at_period_end ? 'ending'
    : ['past_due', 'unpaid', 'paused'].includes(subscription?.status ?? '') ? 'past_due'
    : subscription?.status === 'active' ? 'active' : null;
  if (status) await query(`UPDATE public.subscriptions SET status = $1, updated_at = now()
    WHERE member_id = $2 AND stripe_subscription_id = $3 AND (status <> 'cancelled' OR $1 = 'cancelled')`,
  [status, known.member_id, subscriptionId]);
}

export async function handleStripeWebhook(body: Buffer, signature: string) {
  const event = stripeEvent(body, signature);
  if (event.type === 'invoice.paid') await handlePaidInvoice(event.data.object as StripeInvoice);
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as StripeSubscription;
    await syncSubscription(subscription.id, event.type === 'customer.subscription.deleted');
  }
}
