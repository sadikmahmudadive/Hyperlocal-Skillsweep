import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getTransactionById, getUserById, patchTransaction, patchUser } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const { transactionId } = req.body;

    const transaction = await getTransactionById(transactionId);
    if (!transaction || String(transaction.provider) !== String(userId) || transaction.status !== 'pending') {
      return res.status(404).json({ message: 'Transaction not found or not authorized' });
    }

    const receiver = await getUserById(transaction.receiver);
    const escrow = Number(transaction.credits || 0);

    if (!receiver) {
      return res.status(500).json({ message: 'Receiver not found' });
    }
    if ((receiver.credits || 0) < escrow) {
      return res.status(400).json({ message: 'Receiver has insufficient credits' });
    }

    const nextReceiverCredits = (receiver.credits || 0) - escrow;
    const nextReceiverHeld = (receiver.heldCredits || 0) + escrow;
    await patchUser(receiver.id || receiver._id, {
      credits: nextReceiverCredits,
      heldCredits: nextReceiverHeld,
      ledger: [
        ...(receiver.ledger || []),
        { type: 'hold', amount: escrow, balanceAfter: nextReceiverCredits, txRef: transaction.id || transaction._id, note: 'Held for transaction' }
      ]
    });

    const updatedTx = await patchTransaction(transactionId, {
      status: 'confirmed',
      escrowAmount: escrow,
      heldBy: receiver.id || receiver._id,
      audit: [...(transaction.audit || []), { actor: userId, action: 'confirm', note: 'Provider confirmed and escrow held', ts: new Date().toISOString() }]
    });

    res.status(200).json({ message: 'Transaction confirmed and credits held', transaction: updatedTx });
  } catch (error) {
    console.error('Confirm transaction error:', error);
    res.status(500).json({ message: 'Error confirming transaction' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.transactionsStateChange,
  methods: ['POST'],
  keyPrefix: 'transactions:confirm'
});