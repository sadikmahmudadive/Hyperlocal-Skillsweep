import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { searchUsers } from '../../../lib/firestoreStore';

const limiter = createLimiter(RATE_LIMIT_PROFILES.publicSearch);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!(await enforceRateLimit(limiter, req, res))) return;

    const { query, category, distance = 10, lat, lng } = req.query;

    const users = await searchUsers({ query, category, distance, lat, lng });

    res.status(200).json({ users });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}