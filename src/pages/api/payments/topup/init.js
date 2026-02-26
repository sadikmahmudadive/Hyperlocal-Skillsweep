import { requireAuthRateLimited } from '../../../../middleware/auth';
import payments from '../../../../lib/payments';
import { RATE_LIMIT_PROFILES } from '../../../../lib/rateLimitProfiles';
import { createTopUpIntent, findTopUpIntentByIdempotencyKey, getUserById } from '../../../../lib/firestoreStore';

async function handler(req, res) {
  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }
  // Temporarily allow GET for robustness/troubleshooting in production
  if (method !== 'POST' && method !== 'GET') {
    res.setHeader('Allow', 'POST, GET, OPTIONS');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { credits: bodyCredits, provider: bodyProvider } = req.body || {};
    const credits = method === 'GET' ? Number(req.query.credits) : Number(bodyCredits);
    const provider = method === 'GET' ? req.query.provider : bodyProvider;
    const error = payments.validateTopUp(credits);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!payments.supportedProvider(provider)) return res.status(400).json({ success: false, message: 'Unsupported provider' });

    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const idempotencyKey = payments.createIdempotencyKey(String(user.id || user._id), credits, provider);

    // Reuse existing intent if still pending for same key
    let intent = await findTopUpIntentByIdempotencyKey(idempotencyKey);
    if (!intent) {
      const amountFiat = payments.computeFiat(credits);
      intent = await createTopUpIntent({
        user: user.id || user._id,
        provider,
        credits,
        amountFiat,
        currency: payments.paymentConfig.currency,
        idempotencyKey,
        status: 'initiated'
      });
    }

    // Stub: normally create provider session here
    return res.status(200).json({ success: true, intent: {
      id: intent._id,
      provider: intent.provider,
      credits: intent.credits,
      amountFiat: intent.amountFiat,
      currency: intent.currency,
      status: intent.status,
      idempotencyKey: intent.idempotencyKey
    }, config: payments.paymentConfig });
  } catch (e) {
    console.error('Top-up init error', e);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.paymentsTopupInit,
  methods: ['POST', 'GET'],
  keyPrefix: 'payments:topup:init'
});
