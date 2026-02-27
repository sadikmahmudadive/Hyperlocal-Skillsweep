import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getTransactionById, patchTransaction } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' });
    }

    // Either party can start the service when status is confirmed and escrow is held
    const transaction = await getTransactionById(transactionId);

    if (!transaction || ![String(transaction.provider), String(transaction.receiver)].includes(String(userId)) || transaction.status !== 'confirmed') {
      return res.status(404).json({ message: 'Transaction not found or not in confirmed state' });
    }

    // Ensure escrow is present
    if (transaction.escrowAmount == null || !transaction.heldBy) {
      return res.status(400).json({ message: 'Escrow not present; cannot start transaction' });
    }

    const updated = await patchTransaction(transactionId, {
      status: 'in-progress',
      audit: [...(transaction.audit || []), { actor: userId, action: 'start', note: 'Service started', ts: new Date().toISOString() }]
    });

    res.status(200).json({ message: 'Transaction started', transaction: updated });
  } catch (error) {
    console.error('Start transaction error:', error);
    res.status(500).json({ message: 'Error starting transaction' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.transactionsStateChange,
  methods: ['POST'],
  keyPrefix: 'transactions:start'
});
