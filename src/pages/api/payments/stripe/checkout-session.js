import payments from '../../../../lib/payments';
import { requireAuthRateLimited } from '../../../../middleware/auth';
import { getStripeClient, getAppBaseUrl, toMinorUnits, describeCredits, stripeCurrency } from '../../../../lib/payments/stripe';
import { RATE_LIMIT_PROFILES } from '../../../../lib/rateLimitProfiles';
import { createTopUpIntent, findTopUpIntentByIdempotencyKey, getUserById, patchTopUpIntent } from '../../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  try {
    const { credits } = req.body || {};
    const numericCredits = Number(credits);
    const validation = payments.validateTopUp(numericCredits);
    if (validation) {
      return res.status(400).json({ success: false, message: validation });
    }

    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const provider = 'stripe';
    const amountFiat = payments.computeFiat(numericCredits);
    const idempotencyKey = payments.createIdempotencyKey(String(user.id || user._id), numericCredits, provider);

    let intent = await findTopUpIntentByIdempotencyKey(idempotencyKey);
    if (!intent) {
      intent = await createTopUpIntent({
        user: user.id || user._id,
        provider,
        credits: numericCredits,
        amountFiat,
        currency: stripeCurrency.toUpperCase(),
        status: 'initiated',
        idempotencyKey,
      });
    }

    const stripe = getStripeClient();
    const baseUrl = getAppBaseUrl();
    const successUrl = `${baseUrl}/dashboard?topupSuccess=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard?topupCancelled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_email: user.email,
      client_reference_id: String(intent.id || intent._id),
      metadata: {
        intentId: String(intent.id || intent._id),
        userId: String(user.id || user._id),
        credits: String(numericCredits),
      },
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: describeCredits(numericCredits),
              description: 'SkillSwap wallet top-up',
            },
            unit_amount: toMinorUnits(amountFiat),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    intent = await patchTopUpIntent(intent.id || intent._id, {
      status: 'pending',
      externalRef: session.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      metadata: {
        ...(intent.metadata || {}),
        checkoutSessionId: session.id,
      }
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      intent: {
        id: intent.id || intent._id,
        provider: intent.provider,
        credits: intent.credits,
        amountFiat: intent.amountFiat,
        currency: intent.currency,
        status: intent.status,
      },
      config: payments.paymentConfig,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (error) {
    console.error('Stripe checkout init failed', error);
    return res.status(500).json({ success: false, message: 'Failed to start Stripe checkout' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.paymentsStripeCheckout,
  methods: ['POST'],
  keyPrefix: 'payments:stripe:checkout'
});
