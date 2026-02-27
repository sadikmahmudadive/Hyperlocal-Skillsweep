import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUsersByIds, listReviews } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId, page = '1', limit = '10', authored } = req.query;

    const authoredMode = String(authored) === 'true';
    if (!authoredMode) {
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
    }
    const payload = await listReviews({
      targetUserId: authoredMode ? null : userId,
      reviewerId: authoredMode ? req.userId : null,
      page,
      limit,
    });
    const reviewerIds = Array.from(new Set((payload.reviews || []).map((r) => String(r.reviewer))));
    const targetUserIds = Array.from(new Set((payload.reviews || []).map((r) => String(r.targetUser)).filter(Boolean)));
    const reviewers = await getUsersByIds(reviewerIds);
    const targetUsers = await getUsersByIds(targetUserIds);
    const reviewerMap = new Map(reviewers.map((r) => [String(r.id || r._id), { _id: r.id || r._id, name: r.name, avatar: r.avatar }]));
    const targetUserMap = new Map(targetUsers.map((u) => [String(u.id || u._id), { _id: u.id || u._id, name: u.name, avatar: u.avatar }]));
    const reviews = (payload.reviews || []).map((r) => ({
      ...r,
      reviewer: reviewerMap.get(String(r.reviewer)) || { _id: r.reviewer },
      targetUser: targetUserMap.get(String(r.targetUser)) || { _id: r.targetUser },
    }));

    res.status(200).json({
      reviews,
      page: payload.page,
      total: payload.total,
      pageSize: payload.pageSize,
      totalPages: payload.totalPages
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