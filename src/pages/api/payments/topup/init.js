import dbConnect from '../../../../lib/dbConnect';
import TopUpIntent from '../../../../models/TopUpIntent';
import User from '../../../../models/User';
import { validateJwt } from '../../../../middleware/auth';
import payments from '../../../../lib/payments';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  await dbConnect();
  const auth = await validateJwt(req, res);
  if (!auth) return; // middleware already responded

  try {
    const { credits, provider } = req.body;
    const error = payments.validateTopUp(credits);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!payments.supportedProvider(provider)) return res.status(400).json({ success: false, message: 'Unsupported provider' });

    const user = await User.findById(auth.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const idempotencyKey = payments.createIdempotencyKey(user._id.toString(), credits, provider);

    // Reuse existing intent if still pending for same key
    let intent = await TopUpIntent.findOne({ idempotencyKey, status: { $in: ['initiated','pending'] } });
    if (!intent) {
      const amountFiat = payments.computeFiat(credits);
      intent = await TopUpIntent.create({
        user: user._id,
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
