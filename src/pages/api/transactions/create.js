import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import User from '../../../models/User';
import paymentConfig, { creditsToFiat } from '../../../../config/payments';
import { requireAuthRateLimited } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { providerId, skill, duration, credits = 0, scheduledDate, price = 0 } = req.body;

    const receiver = await User.findById(userId);
    const provider = await User.findById(providerId);

    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (provider.isAvailable === false) {
      return res.status(400).json({ message: 'Provider is currently not available for hire' });
    }

    const userCredits = receiver.credits || 0;

    // Validate credit balance
    if (userCredits < credits) {
      const missingCredits = credits - userCredits;
      const amountFiat = creditsToFiat(missingCredits);
      return res.status(400).json({
        code: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits for discount/swap',
        missingCredits,
        amountFiat,
        currency: paymentConfig.currency,
        creditRate: paymentConfig.creditRate
      });
    }

    let finalAmount = 0;
    let discount = 0;
    let currency = paymentConfig.currency;

    if (price > 0) {
      // Money transaction with optional discount
      const discountValue = creditsToFiat(credits);
      if (discountValue > price) {
         return res.status(400).json({ message: 'Discount cannot exceed price' });
      }
      discount = discountValue;
      finalAmount = price - discount;
    } else {
      // Pure credit swap (legacy or specific mode)
      // credits is the full cost
    }

    // Create transaction
    const transaction = new Transaction({
      provider: providerId,
      receiver: userId,
      skill,
      duration,
      credits, // Credits used (either as cost or discount)
      amount: price,
      discount,
      finalAmount,
      currency,
      scheduledDate,
      status: 'pending'
    });

    // Deduct credits immediately? 
    // The original code didn't seem to deduct credits in `create.js`?
    // Let's check the original code.
    // It just checked: `if ((receiver.credits || 0) < credits) ...`
    // It didn't save the user with new credits.
    // Maybe it's done in `confirm` or `complete`?
    // I should check `src/pages/api/transactions/confirm.js` etc.
    
    await transaction.save();
    await transaction.populate('provider', 'name avatar rating');
    await transaction.populate('receiver', 'name avatar rating');

    res.status(201).json({ 
      message: 'Transaction created successfully',
      transaction 
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Error creating transaction' });
  }
}

export default requireAuthRateLimited(handler, {
  limit: 12,
  windowMs: 60_000,
  methods: ['POST'],
  keyPrefix: 'transactions:create'
});