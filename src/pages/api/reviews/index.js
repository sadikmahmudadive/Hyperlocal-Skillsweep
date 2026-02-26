import dbConnect from '../../../lib/dbConnect';
import Review from '../../../models/Review';
import mongoose from 'mongoose';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const { userId, page = '1', limit = '10', authored } = req.query;

    const authoredMode = String(authored) === 'true';
    if (!authoredMode) {
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
    }
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = authoredMode ? { reviewer: req.userId } : { targetUser: userId };
    const [reviews, total] = await Promise.all([
      Review.find(query)
      .populate('reviewer', 'name avatar')
      .populate('transaction')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
      Review.countDocuments(query)
    ]);

    res.status(200).json({
      reviews,
      page: pageNum,
      total,
      pageSize: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.reviewsRead,
  methods: ['GET'],
  keyPrefix: 'reviews:index'
});