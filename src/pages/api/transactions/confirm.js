import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
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
      provider: userId, // Only provider can confirm
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or not authorized' });
    }

    transaction.status = 'confirmed';
    await transaction.save();

    await transaction.populate('provider', 'name avatar');
    await transaction.populate('receiver', 'name avatar');

    res.status(200).json({
      message: 'Transaction confirmed successfully',
      transaction
    });
  } catch (error) {
    console.error('Confirm transaction error:', error);
    res.status(500).json({ message: 'Error confirming transaction' });
  }
}

export default requireAuth(handler);