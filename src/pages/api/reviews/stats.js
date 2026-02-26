import dbConnect from '../../../lib/dbConnect';
import Review from '../../../models/Review';
import mongoose from 'mongoose';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';

const limiter = createLimiter({ limit: 60, windowMs: 60_000 });

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    if (!(await enforceRateLimit(limiter, req, res))) return;
    await dbConnect();
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const pipeline = [
      { $match: { targetUser: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ];

    const grouped = await Review.aggregate(pipeline);
    const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    for (const g of grouped) {
      const r = String(g._id);
      const c = g.count || 0;
      if (stars[r] !== undefined) {
        stars[r] = c;
        total += c;
        sum += (parseInt(r, 10) || 0) * c;
      }
    }
    const average = total ? Math.round((sum / total) * 10) / 10 : 0;

    res.status(200).json({ average, count: total, distribution: stars });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({ message: 'Error fetching review stats' });
  }
}
