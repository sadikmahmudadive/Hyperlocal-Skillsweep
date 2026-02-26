import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { anchorTransactionProof } from '../../../lib/blockchain';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await dbConnect();
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ message: 'transactionId required' });

    const tx = await Transaction.findById(transactionId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    // Call helper
    const result = await anchorTransactionProof(tx);
    if (!result.ok) return res.status(500).json({ message: 'Anchor failed', reason: result.reason });

    res.status(200).json({ message: 'Anchored', onChainTxHash: result.hash, proof: result.proof });
  } catch (err) {
    console.error('Anchor API error:', err);
    res.status(500).json({ message: 'Error anchoring', error: err.message });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chainAnchorWrite,
  methods: ['POST'],
  keyPrefix: 'chain:anchor'
});
