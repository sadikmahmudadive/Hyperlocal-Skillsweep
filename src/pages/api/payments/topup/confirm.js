import { requireAuthRateLimited } from '../../../../middleware/auth';
import payments from '../../../../lib/payments';
import { RATE_LIMIT_PROFILES } from '../../../../lib/rateLimitProfiles';
import { findTopUpIntentById, getUserById, patchTopUpIntent, patchUser } from '../../../../lib/firestoreStore';

async function handler(req, res) {
  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    const { intentId } = req.body;
    if (!intentId) return res.status(400).json({ success: false, message: 'intentId required' });
    const intent = await findTopUpIntentById(intentId);
    if (!intent) return res.status(404).json({ success: false, message: 'Intent not found' });
    if (String(intent.user) !== String(req.userId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (intent.status === 'confirmed') {
      return res.status(200).json({ success: true, alreadyConfirmed: true, credits: intent.credits, balance: undefined });
    }

    // Stub provider verification: in production validate provider transaction reference.
    await patchTopUpIntent(intentId, { status: 'confirmed', confirmedAt: new Date().toISOString() });

    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const nextBalance = (user.credits || 0) + Number(intent.credits || 0);
    await patchUser(req.userId, {
      credits: nextBalance,
      ledger: [
        ...(user.ledger || []),
        { type: 'topup', amount: intent.credits, balanceAfter: nextBalance, note: `Top up via ${intent.provider}` }
      ]
    });

    return res.status(200).json({ success: true, creditsAdded: intent.credits, balance: nextBalance, currency: payments.paymentConfig.currency });
  } catch (e) {
    console.error('Top-up confirm error', e);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.paymentsTopupConfirm,
  methods: ['POST'],
  keyPrefix: 'payments:topup:confirm'
});
