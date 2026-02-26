import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUsersByIds, listTransactionsForUser } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const { status } = req.query;

    const transactions = await listTransactionsForUser(userId, status);
    const userIds = Array.from(new Set(transactions.flatMap((tx) => [String(tx.provider), String(tx.receiver)])));
    const users = await getUsersByIds(userIds);
    const byId = new Map(users.map((u) => [String(u.id || u._id), u]));
    const hydrated = transactions.map((tx) => ({
      ...tx,
      provider: byId.get(String(tx.provider)) || { _id: tx.provider, id: tx.provider },
      receiver: byId.get(String(tx.receiver)) || { _id: tx.receiver, id: tx.receiver },
    }));

    // Categorize transactions
    const categorized = {
      pending: hydrated.filter(t => t.status === 'pending'),
      confirmed: hydrated.filter(t => t.status === 'confirmed'),
      inProgress: hydrated.filter(t => t.status === 'in-progress'),
      completed: hydrated.filter(t => t.status === 'completed'),
      cancelled: hydrated.filter(t => t.status === 'cancelled')
    };

    res.status(200).json({
      transactions: hydrated,
      categorized,
      stats: {
        total: hydrated.length,
        pending: categorized.pending.length,
        inProgress: categorized.inProgress.length,
        completed: categorized.completed.length
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.transactionsRead,
  methods: ['GET'],
  keyPrefix: 'transactions:index'
});