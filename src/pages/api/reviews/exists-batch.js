import dbConnect from '../../../lib/dbConnect';
import Review from '../../../models/Review';
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
  const { transactionIds } = req.body || {};

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ message: 'transactionIds array is required' });
    }

    const validIds = transactionIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(200).json({ reviewedTransactionIds: [], reviewsByTransaction: {} });
    }

    const reviews = await Review.find({
      reviewer: userId,
      transaction: { $in: validIds }
    }).select('transaction rating comment createdAt');

    const reviewedIds = reviews.map(r => String(r.transaction));
    const map = {};
    for (const r of reviews) {
      map[String(r.transaction)] = { id: String(r._id), rating: r.rating, comment: r.comment || '', createdAt: r.createdAt };
    }
    res.status(200).json({ reviewedTransactionIds: reviewedIds, reviewsByTransaction: map });
  } catch (error) {
    console.error('Reviews exists-batch error:', error);
    res.status(500).json({ message: 'Error checking reviews' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.reviewsExistsBatchWrite,
  methods: ['POST'],
  keyPrefix: 'reviews:exists-batch'
});
