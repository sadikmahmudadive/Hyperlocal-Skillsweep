import dbConnect from '../../../../lib/dbConnect';
import TopUpIntent from '../../../../models/TopUpIntent';
import User from '../../../../models/User';
import { validateJwt } from '../../../../middleware/auth';
import payments from '../../../../lib/payments';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  await dbConnect();
  const auth = await validateJwt(req, res);
  if (!auth) return;

  try {
    const { intentId } = req.body;
    if (!intentId) return res.status(400).json({ success: false, message: 'intentId required' });
    const intent = await TopUpIntent.findById(intentId);
    if (!intent) return res.status(404).json({ success: false, message: 'Intent not found' });
    if (intent.user.toString() !== auth.userId) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (intent.status === 'confirmed') {
      return res.status(200).json({ success: true, alreadyConfirmed: true, credits: intent.credits, balance: undefined });
    }

    // Stub provider verification: in production validate provider transaction reference.
    intent.status = 'confirmed';
    intent.confirmedAt = new Date();
    await intent.save();

    const user = await User.findById(auth.userId);
    const balance = await payments.recordLedgerEntry(user, 'topup', intent.credits, `Top up via ${intent.provider}`);

    return res.status(200).json({ success: true, creditsAdded: intent.credits, balance, currency: payments.paymentConfig.currency });
  } catch (e) {
    console.error('Top-up confirm error', e);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}
