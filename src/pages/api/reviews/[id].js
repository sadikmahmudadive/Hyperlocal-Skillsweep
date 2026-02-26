import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { deleteReview, findReviewById, patchReview, patchUser, reviewStats } from '../../../lib/firestoreStore';

async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'Invalid review id' });
  }
  if (!['PUT','DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const review = await findReviewById(id);
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
      await patchReview(id, { rating: parsed, comment: comment || '' });
    }

    if (req.method === 'DELETE') {
      await deleteReview(id);
    }

    // Recompute target user's rating
    const targetUserId = review.targetUser;
    const stat = await reviewStats(targetUserId);
    await patchUser(targetUserId, { rating: { average: stat.average, count: stat.count } });

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
