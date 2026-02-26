import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUserById, getUsersByIds, patchUser } from '../../../lib/firestoreStore';

const basicUserProjection = 'name avatar rating skillsOffered credits location bio';
const writeLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.usersFavoritesWrite,
  keyGenerator: (req) => {
    const xfwd = req.headers['x-forwarded-for'];
    const ip = Array.isArray(xfwd)
      ? xfwd[0]
      : (xfwd ? xfwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown');
    return `users:favorites:${ip}:${req.method}`;
  },
});

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const currentUser = await getUserById(decoded.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.method === 'GET') {
      const favorites = await getUsersByIds(currentUser.favorites || []);

      return res.status(200).json({
        ids: (currentUser.favorites || []).map((id) => String(id)),
        favorites: favorites.map((fav) => ({
          ...fav,
          id: String(fav.id || fav._id)
        }))
      });
    }

    const { providerId } = req.body || {};
    if (!providerId) {
      return res.status(400).json({ message: 'Valid providerId is required' });
    }

    if (providerId === decoded.userId) {
      return res.status(400).json({ message: 'You cannot favorite yourself' });
    }

    const provider = await getUserById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (req.method === 'POST') {
      if (!(await enforceRateLimit(writeLimiter, req, res))) {
        return;
      }
      currentUser.favorites = currentUser.favorites || [];
      if (!currentUser.favorites.some((favId) => String(favId) === String(providerId))) {
        currentUser.favorites.push(String(providerId));
        await patchUser(decoded.userId, { favorites: currentUser.favorites });
      }

      return res.status(200).json({
        ids: currentUser.favorites.map((id) => String(id)),
        favorite: { ...provider, id: String(provider.id || provider._id) }
      });
    }

    if (req.method === 'DELETE') {
      if (!(await enforceRateLimit(writeLimiter, req, res))) {
        return;
      }
      const before = (currentUser.favorites || []).length;
      currentUser.favorites = (currentUser.favorites || []).filter((favId) => String(favId) !== String(providerId));
      if (currentUser.favorites.length !== before) {
        await patchUser(decoded.userId, { favorites: currentUser.favorites });
      }
      return res.status(200).json({ ids: currentUser.favorites.map((id) => String(id)) });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Favorites API error:', error);
    return res.status(500).json({ message: 'Failed to process favorites request' });
  }
}
