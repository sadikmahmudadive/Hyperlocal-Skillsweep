import dbConnect from '../../../lib/dbConnect';
import Review from '../../../models/Review';
import User from '../../../models/User';
import mongoose from 'mongoose';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

async function handler(req, res) {
  const { id } = req.query;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid review id' });
  }
  if (!['PUT','DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (String(review.reviewer) !== String(userId)) {
      return res.status(403).json({ message: 'You can only modify your own review' });
    }

    const createdAt = new Date(review.createdAt).getTime();
    const diffMs = Date.now() - createdAt;
    const within24h = diffMs <= 24 * 60 * 60 * 1000;

    if (req.method === 'PUT') {
      const { rating, comment } = req.body || {};
      const parsed = Number(rating);
      if (!(parsed >= 1 && parsed <= 5)) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      if (!within24h) {
        return res.status(400).json({ message: 'Edits are allowed within 24 hours of posting' });
      }
      review.rating = parsed;
      review.comment = comment || '';
      await review.save();
    }

    if (req.method === 'DELETE') {
      await review.deleteOne();
    }

    // Recompute target user's rating
    const targetUserId = review.targetUser;
    const [stat] = await Review.aggregate([
      { $match: { targetUser: new mongoose.Types.ObjectId(targetUserId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = stat?.avg ? Math.round(stat.avg * 10) / 10 : 0;
    const count = stat?.count || 0;
    await User.findByIdAndUpdate(targetUserId, { $set: { 'rating.average': avg, 'rating.count': count } });

    return res.status(200).json({ message: req.method === 'DELETE' ? 'Review deleted' : 'Review updated' });
  } catch (error) {
    console.error('Update/delete review error:', error);
    res.status(500).json({ message: 'Error processing request' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.reviewsWrite,
  methods: ['PUT', 'DELETE'],
  keyPrefix: 'reviews:item'
});
