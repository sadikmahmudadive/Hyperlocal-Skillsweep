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
    if (!transaction || ![String(transaction.provider), String(transaction.receiver)].includes(String(userId))) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    if (transaction.status !== 'in-progress') {
      return res.status(400).json({ message: 'Transaction not in progress' });
    }

    const escrow = Number(transaction.escrowAmount || transaction.credits || 0);
    const receiver = await getUserById(transaction.receiver);
    const provider = await getUserById(transaction.provider);

    if (!receiver || !provider) {
      return res.status(500).json({ message: 'User accounts not found' });
    }
    if ((receiver.heldCredits || 0) < escrow) {
      return res.status(500).json({ message: 'Held credits insufficient for release' });
    }

    await patchUser(receiver.id || receiver._id, {
      heldCredits: (receiver.heldCredits || 0) - escrow,
      ledger: [
        ...(receiver.ledger || []),
        { type: 'spend', amount: escrow, balanceAfter: receiver.credits || 0, txRef: transaction.id || transaction._id, note: 'Spent on completed transaction' }
      ]
    });
    await patchUser(provider.id || provider._id, {
      credits: (provider.credits || 0) + escrow,
      ledger: [
        ...(provider.ledger || []),
        { type: 'release', amount: escrow, balanceAfter: (provider.credits || 0) + escrow, txRef: transaction.id || transaction._id, note: 'Received credits for service' }
      ]
    });

    const updatedTx = await patchTransaction(transactionId, {
      status: 'completed',
      completedDate: new Date().toISOString(),
      audit: [...(transaction.audit || []), { actor: userId, action: 'complete', note: 'Transaction completed and escrow released', ts: new Date().toISOString() }]
    });

    try {
      if (process.env.ENABLE_CHAIN === 'true') {
        const { anchorTransactionProof } = require('../../../lib/blockchain');
        anchorTransactionProof(updatedTx).catch(() => {});
      }
    } catch (_) {}

    res.status(200).json({ message: 'Transaction completed successfully', transaction: updatedTx });
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(500).json({ message: 'Error completing transaction' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.transactionsStateChange,
  methods: ['POST'],
  keyPrefix: 'transactions:complete'
});