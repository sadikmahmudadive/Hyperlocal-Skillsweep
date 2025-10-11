import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import User from '../../../models/User';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { providerId, skill, duration, credits, scheduledDate } = req.body;

    // Check if receiver has enough credits
    const receiver = await User.findById(userId);
    if (receiver.credits < credits) {
      return res.status(400).json({ message: 'Insufficient credits' });
    }

    // Create transaction
    const transaction = new Transaction({
      provider: providerId,
      receiver: userId,
      skill,
      duration,
      credits,
      scheduledDate,
      status: 'pending'
    });

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

export default requireAuth(handler);