import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { reviewStats } from '../../../lib/firestoreStore';

const limiter = createLimiter(RATE_LIMIT_PROFILES.publicReviewStats);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    if (!(await enforceRateLimit(limiter, req, res))) return;
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const stats = await reviewStats(userId);
    res.status(200).json({ average: stats.average, count: stats.count, distribution: stats.distribution });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({ message: 'Error fetching review stats' });
  }
}
