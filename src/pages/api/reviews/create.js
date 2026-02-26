import dbConnect from '../../../lib/dbConnect';
import Review from '../../../models/Review';
import User from '../../../models/User';
import Transaction from '../../../models/Transaction';
import mongoose from 'mongoose';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { targetUserId, rating, comment, transactionId } = req.body || {};

    // Check if user is reviewing themselves
    if (userId === targetUserId) {
      return res.status(400).json({ message: 'Cannot review yourself' });
    }

    // Basic payload validation
    if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: 'A valid transactionId is required' });
    }
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'A valid targetUserId is required' });
    }
    const parsedRating = Number(rating);
    if (!(parsedRating >= 1 && parsedRating <= 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Ensure the transaction exists and the requester participated
    const tx = await Transaction.findById(transactionId).populate('provider receiver', 'name');
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    const isParticipant = [String(tx.provider._id), String(tx.receiver._id)].includes(String(userId));
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a participant in this transaction' });
    }
    // Only allow reviewing the other participant
    const otherPartyId = String(tx.provider._id) === String(userId) ? String(tx.receiver._id) : String(tx.provider._id);
    if (String(targetUserId) !== otherPartyId) {
      return res.status(400).json({ message: 'Invalid target user for this transaction' });
    }
    // Ensure transaction is completed before review
    if (tx.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review completed transactions' });
    }

    // Check if review already exists for this transaction
    const existingReview = await Review.findOne({
      reviewer: userId,
      targetUser: targetUserId,
      transaction: transactionId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this user for this transaction' });
    }

    // Create review
    const review = new Review({
      reviewer: userId,
      targetUser: targetUserId,
      rating: parsedRating,
      comment,
      transaction: transactionId
    });

    await review.save();

    // Update target user's average rating (aggregation)
    const [stat] = await Review.aggregate([
      { $match: { targetUser: new mongoose.Types.ObjectId(targetUserId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = stat?.avg ? Math.round(stat.avg * 10) / 10 : 0;
    const count = stat?.count || 0;
    await User.findByIdAndUpdate(targetUserId, { $set: { 'rating.average': avg, 'rating.count': count } });

    // Populate reviewer info for response
    await review.populate('reviewer', 'name avatar');

    res.status(201).json({
      message: 'Review submitted successfully',
      review
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