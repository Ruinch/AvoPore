import { getBillingMode, handleStripeWebhook, StripeSignatureError } from '../../../../lib/billing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (getBillingMode() !== 'stripe') return Response.json({ error: 'Stripe test billing is unavailable.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 });

  try {
    const body = Buffer.from(await request.arrayBuffer());
    await handleStripeWebhook(body, signature);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof StripeSignatureError) return Response.json({ error: error.message }, { status: 400 });
    console.error('Stripe webhook processing failed', error);
    return Response.json({ error: 'Unable to process the Stripe event.' }, { status: 500 });
  }
}
