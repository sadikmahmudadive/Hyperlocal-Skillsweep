import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { createReview, findReviewByUnique, getTransactionById, getUserById, patchUser, reviewStats } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const { targetUserId, rating, comment, transactionId } = req.body || {};

    // Check if user is reviewing themselves
    if (userId === targetUserId) {
      return res.status(400).json({ message: 'Cannot review yourself' });
    }

    // Basic payload validation
    if (!transactionId) {
      return res.status(400).json({ message: 'A valid transactionId is required' });
    }
    if (!targetUserId) {
      return res.status(400).json({ message: 'A valid targetUserId is required' });
    }
    const parsedRating = Number(rating);
    if (!(parsedRating >= 1 && parsedRating <= 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Ensure the transaction exists and the requester participated
    const tx = await getTransactionById(transactionId);
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    const isParticipant = [String(tx.provider), String(tx.receiver)].includes(String(userId));
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a participant in this transaction' });
    }
    // Only allow reviewing the other participant
    const otherPartyId = String(tx.provider) === String(userId) ? String(tx.receiver) : String(tx.provider);
    if (String(targetUserId) !== otherPartyId) {
      return res.status(400).json({ message: 'Invalid target user for this transaction' });
    }
    // Ensure transaction is completed before review
    if (tx.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review completed transactions' });
    }

    // Check if review already exists for this transaction
    const existingReview = await findReviewByUnique({
      reviewer: userId,
      targetUser: targetUserId,
      transaction: transactionId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this user for this transaction' });
    }

    // Create review
    const review = await createReview({
      reviewer: userId,
      targetUser: targetUserId,
      rating: parsedRating,
      comment,
      transaction: transactionId
    });

    const stat = await reviewStats(targetUserId);
    await patchUser(targetUserId, { rating: { average: stat.average, count: stat.count } });

    const reviewer = await getUserById(userId);
    const reviewPayload = {
      ...review,
      reviewer: reviewer ? { _id: reviewer.id || reviewer._id, name: reviewer.name, avatar: reviewer.avatar } : { _id: userId }
    };

    res.status(201).json({
      message: 'Review submitted successfully',
      review: reviewPayload
    });
  } catch (error) {
    console.error('Create review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this user for this transaction' });
    }
    res.status(500).json({ message: 'Error submitting review' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.reviewsWrite,
  methods: ['POST'],
  keyPrefix: 'reviews:create'
});