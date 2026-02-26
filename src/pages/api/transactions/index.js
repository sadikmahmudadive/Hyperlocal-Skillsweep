import dbConnect from '../../../lib/dbConnect';
import Transaction from '../../../models/Transaction';
import { requireAuthRateLimited } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { status, type } = req.query;

    let query = {
      $or: [{ provider: userId }, { receiver: userId }]
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .populate('provider', 'name avatar rating')
      .populate('receiver', 'name avatar rating')
      .sort({ createdAt: -1 })
      .limit(50);

    // Categorize transactions
    const categorized = {
      pending: transactions.filter(t => t.status === 'pending'),
      confirmed: transactions.filter(t => t.status === 'confirmed'),
      inProgress: transactions.filter(t => t.status === 'in-progress'),
      completed: transactions.filter(t => t.status === 'completed'),
      cancelled: transactions.filter(t => t.status === 'cancelled')
    };

    res.status(200).json({
      transactions,
      categorized,
      stats: {
        total: transactions.length,
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
  limit: 80,
  windowMs: 60_000,
  methods: ['GET'],
  keyPrefix: 'transactions:index'
});