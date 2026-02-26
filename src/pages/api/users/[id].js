import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUserById } from '../../../lib/firestoreStore';

const limiter = createLimiter(RATE_LIMIT_PROFILES.publicUserProfile);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!(await enforceRateLimit(limiter, req, res))) return;
    const { id } = req.query;

    // Validate ID format
    if (!id || id === 'undefined') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUser = {
      ...user,
      password: undefined,
      email: undefined,
    };

    res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error('Get user profile error:', error);

    res.status(500).json({ message: 'Error fetching user profile' });
  }
}