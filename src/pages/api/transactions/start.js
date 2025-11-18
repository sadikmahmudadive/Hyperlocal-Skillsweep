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

    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' });
    }

    // Either party can start the service when status is confirmed and escrow is held
    const transaction = await Transaction.findOne({
      _id: transactionId,
      $or: [{ provider: userId }, { receiver: userId }],
      status: 'confirmed'
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or not in confirmed state' });
    }

    // Ensure escrow is present
    if (!transaction.escrowAmount || !transaction.heldBy) {
      return res.status(400).json({ message: 'Escrow not present; cannot start transaction' });
    }

    transaction.status = 'in-progress';
    transaction.audit = transaction.audit || [];
    transaction.audit.push({ actor: userId, action: 'start', note: 'Service started', ts: new Date() });
    await transaction.save();

    res.status(200).json({ message: 'Transaction started', transaction });
  } catch (error) {
    console.error('Start transaction error:', error);
    res.status(500).json({ message: 'Error starting transaction' });
  }
}

export default requireAuth(handler);
