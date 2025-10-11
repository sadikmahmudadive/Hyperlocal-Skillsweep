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
    const { transactionId } = req.body;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [{ provider: userId }, { receiver: userId }]
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status !== 'in-progress') {
      return res.status(400).json({ message: 'Transaction not in progress' });
    }

    // Update credits
    await User.findByIdAndUpdate(transaction.provider, {
      $inc: { credits: transaction.credits }
    });

    await User.findByIdAndUpdate(transaction.receiver, {
      $inc: { credits: -transaction.credits }
    });

    // Update transaction status
    transaction.status = 'completed';
    transaction.completedDate = new Date();
    await transaction.save();

    res.status(200).json({ 
      message: 'Transaction completed successfully',
      transaction 
    });
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(500).json({ message: 'Error completing transaction' });
  }
}

export default requireAuth(handler);