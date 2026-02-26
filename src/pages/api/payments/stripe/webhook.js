import payments from '../../../../lib/payments';
import { getStripeClient } from '../../../../lib/payments/stripe';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../../lib/rateLimitProfiles';
import { findTopUpIntentById, getUserById, patchTopUpIntent, patchUser } from '../../../../lib/firestoreStore';

export const config = {
  api: {
    bodyParser: false,
  },
};

const relevantEvents = new Set(['checkout.session.completed']);
const webhookLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.paymentsStripeWebhook,
  keyGenerator: (req) => {
    const xfwd = req.headers['x-forwarded-for'];
    const ip = Array.isArray(xfwd)
      ? xfwd[0]
      : (xfwd ? xfwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown');
    return `payments:webhook:${ip}`;
  },
});

function bufferFromStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  if (!(await enforceRateLimit(webhookLimiter, req, res))) {
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ received: false, message: 'Stripe webhook not configured' });
  }

  const stripe = getStripeClient();

  let event;
  try {
    const buf = await bufferFromStream(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!relevantEvents.has(event.type)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error', err);
    return res.status(500).json({ received: false });
  }
}

async function handleCheckoutSessionCompleted(session) {
  const intentId = session?.metadata?.intentId;
  if (!intentId) return;

  const intent = await findTopUpIntentById(intentId);
  if (!intent) return;

  if (intent.status === 'confirmed') {
    return;
  }

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid) {
    await patchTopUpIntent(intentId, {
      status: 'failed',
      metadata: { ...(intent.metadata || {}), lastEvent: session }
    });
    return;
  }

  await patchTopUpIntent(intentId, {
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    externalRef: session.payment_intent || session.id,
    stripeSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : intent.stripePaymentIntentId,
    metadata: { ...(intent.metadata || {}), checkoutSession: session }
  });

  const user = await getUserById(intent.user);
  if (!user) return;

  const nextBalance = (user.credits || 0) + Number(intent.credits || 0);
  await patchUser(intent.user, {
    credits: nextBalance,
    ledger: [
      ...(user.ledger || []),
      {
        type: 'topup',
        amount: intent.credits,
        balanceAfter: nextBalance,
        txRef: intent.stripePaymentIntentId || intent.externalRef,
        note: 'Top up via Stripe'
      }
    ]
  });
}

export default handler;
