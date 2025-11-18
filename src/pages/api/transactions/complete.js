import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import User from '../../../models/User';
import mongoose from 'mongoose';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { transactionId } = req.body;

    // Atomically release escrow to the provider and record ledger entries
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const transaction = await Transaction.findOne({
        _id: transactionId,
        $or: [{ provider: userId }, { receiver: userId }]
      }).session(session);

      if (!transaction) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Transaction not found' });
      }

      if (transaction.status !== 'in-progress') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Transaction not in progress' });
      }

      const escrow = transaction.escrowAmount || transaction.credits || 0;

      const receiver = await User.findById(transaction.receiver).session(session);
      const provider = await User.findById(transaction.provider).session(session);

      if (!receiver || !provider) {
        throw new Error('User accounts not found');
      }

      // Ensure receiver has held credits
      if ((receiver.heldCredits || 0) < escrow) {
        throw new Error('Held credits insufficient for release');
      }

      // Release held credits from receiver and credit provider
      receiver.heldCredits = (receiver.heldCredits || 0) - escrow;
      // receiver.credits already debited at hold time

      provider.credits = (provider.credits || 0) + escrow;

      receiver.ledger = receiver.ledger || [];
      provider.ledger = provider.ledger || [];

      receiver.ledger.push({ type: 'spend', amount: escrow, balanceAfter: receiver.credits, txRef: transaction._id, note: 'Spent on completed transaction' });
      provider.ledger.push({ type: 'release', amount: escrow, balanceAfter: provider.credits, txRef: transaction._id, note: 'Received credits for service' });

      transaction.status = 'completed';
      transaction.completedDate = new Date();
      transaction.audit = transaction.audit || [];
      transaction.audit.push({ actor: userId, action: 'complete', note: 'Transaction completed and escrow released', ts: new Date() });

      await receiver.save({ session });
      await provider.save({ session });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: 'Transaction completed successfully', transaction });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error('Complete transaction error:', err);
      res.status(500).json({ message: err.message || 'Error completing transaction' });
    }
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(500).json({ message: 'Error completing transaction' });
  }
}

export default requireAuth(handler);