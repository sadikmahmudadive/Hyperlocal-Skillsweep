import dbConnect from '../../../../lib/dbConnect';
import TopUpIntent from '../../../../models/TopUpIntent';
import User from '../../../../models/User';
import { requireAuth } from '../../../../middleware/auth';
import payments from '../../../../lib/payments';

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
  await dbConnect();

  try {
    const { intentId } = req.body;
    if (!intentId) return res.status(400).json({ success: false, message: 'intentId required' });
    const intent = await TopUpIntent.findById(intentId);
    if (!intent) return res.status(404).json({ success: false, message: 'Intent not found' });
    if (intent.user.toString() !== req.userId) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (intent.status === 'confirmed') {
      return res.status(200).json({ success: true, alreadyConfirmed: true, credits: intent.credits, balance: undefined });
    }

    // Stub provider verification: in production validate provider transaction reference.
    intent.status = 'confirmed';
    intent.confirmedAt = new Date();
    await intent.save();

    const user = await User.findById(req.userId);
    const balance = await payments.recordLedgerEntry(user, 'topup', intent.credits, `Top up via ${intent.provider}`);

    return res.status(200).json({ success: true, creditsAdded: intent.credits, balance, currency: payments.paymentConfig.currency });
  } catch (e) {
    console.error('Top-up confirm error', e);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

export default requireAuth(handler);
