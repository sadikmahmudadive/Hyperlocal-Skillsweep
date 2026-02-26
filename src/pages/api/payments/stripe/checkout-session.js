import dbConnect from '../../../../lib/dbConnect';
import payments from '../../../../lib/payments';
import { requireAuthRateLimited } from '../../../../middleware/auth';
import User from '../../../../models/User';
import TopUpIntent from '../../../../models/TopUpIntent';
import { getStripeClient, getAppBaseUrl, toMinorUnits, describeCredits, stripeCurrency } from '../../../../lib/payments/stripe';
import { RATE_LIMIT_PROFILES } from '../../../../lib/rateLimitProfiles';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  await dbConnect();

  try {
    const { credits } = req.body || {};
    const numericCredits = Number(credits);
    const validation = payments.validateTopUp(numericCredits);
    if (validation) {
      return res.status(400).json({ success: false, message: validation });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const provider = 'stripe';
    const amountFiat = payments.computeFiat(numericCredits);
    const idempotencyKey = payments.createIdempotencyKey(user._id.toString(), numericCredits, provider);

    let intent = await TopUpIntent.findOne({ idempotencyKey, status: { $in: ['initiated', 'pending'] } });
    if (!intent) {
      intent = await TopUpIntent.create({
        user: user._id,
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
      client_reference_id: intent._id.toString(),
      metadata: {
        intentId: intent._id.toString(),
        userId: user._id.toString(),
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

    intent.status = 'pending';
    intent.externalRef = session.id;
    intent.stripeSessionId = session.id;
    intent.stripePaymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
    intent.metadata = {
      ...(intent.metadata || {}),
      checkoutSessionId: session.id,
    };
    await intent.save();

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      intent: {
        id: intent._id,
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
