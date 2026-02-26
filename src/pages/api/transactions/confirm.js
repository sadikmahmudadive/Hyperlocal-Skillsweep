import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import User from '../../../models/User';
import mongoose from 'mongoose';
import { requireAuthRateLimited } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { transactionId } = req.body;

    // Use a MongoDB transaction to atomically hold credits from the receiver
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const transaction = await Transaction.findOne({
        _id: transactionId,
        provider: userId, // Only provider can confirm
        status: 'pending'
      }).session(session);

      if (!transaction) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Transaction not found or not authorized' });
      }

      const receiver = await User.findById(transaction.receiver).session(session);
      const escrow = transaction.credits || 0;

      if (!receiver) {
        throw new Error('Receiver not found');
      }

      if ((receiver.credits || 0) < escrow) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Receiver has insufficient credits' });
      }

      // Move credits to held
      receiver.credits = (receiver.credits || 0) - escrow;
      receiver.heldCredits = (receiver.heldCredits || 0) + escrow;
      receiver.ledger = receiver.ledger || [];
      receiver.ledger.push({ type: 'hold', amount: escrow, balanceAfter: receiver.credits, txRef: transaction._id, note: 'Held for transaction' });

      // Update transaction to record escrow
      transaction.status = 'confirmed';
      transaction.escrowAmount = escrow;
      transaction.heldBy = receiver._id;
      transaction.audit = transaction.audit || [];
      transaction.audit.push({ actor: userId, action: 'confirm', note: 'Provider confirmed and escrow held', ts: new Date() });

      await receiver.save({ session });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      await transaction.populate('provider', 'name avatar');
      await transaction.populate('receiver', 'name avatar');

      res.status(200).json({ message: 'Transaction confirmed and credits held', transaction });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('Confirm transaction error:', err);
      res.status(500).json({ message: err.message || 'Error confirming transaction' });
    }
  } catch (error) {
    console.error('Confirm transaction error:', error);
    res.status(500).json({ message: 'Error confirming transaction' });
  }
}

export default requireAuthRateLimited(handler, {
  limit: 20,
  windowMs: 60_000,
  methods: ['POST'],
  keyPrefix: 'transactions:confirm'
});