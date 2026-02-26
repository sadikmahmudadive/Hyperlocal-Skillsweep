import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUserById, patchUser } from '../../../lib/firestoreStore';

const ALLOWED_FILTER_KEYS = ['query', 'category', 'distance', 'sort', 'withinRadius', 'autoFit'];
const writeLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.usersSavedSearchesWrite,
  keyGenerator: (req) => {
    const xfwd = req.headers['x-forwarded-for'];
    const ip = Array.isArray(xfwd)
      ? xfwd[0]
      : (xfwd ? xfwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown');
    return `users:saved-searches:${ip}:${req.method}`;
  },
});

const sanitizeFilters = (filters = {}) => {
  const cleaned = {};
  ALLOWED_FILTER_KEYS.forEach((key) => {
    if (key in filters) cleaned[key] = filters[key];
  });
  return cleaned;
};

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
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const toResponse = () => (user.savedSearches || []).map((entry) => ({
      id: entry.id || entry._id,
      name: entry.name,
      filters: entry.filters,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }));

    if (req.method === 'GET') {
      return res.status(200).json({ savedSearches: toResponse() });
    }

    if (req.method === 'POST') {
      if (!(await enforceRateLimit(writeLimiter, req, res))) {
        return;
      }
      const { name, filters } = req.body || {};
      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'Name is required' });
      }
      if (trimmedName.length > 60) {
        return res.status(400).json({ message: 'Name too long (max 60 characters)' });
      }
      const sanitized = sanitizeFilters(filters || {});
      if (!user.savedSearches) user.savedSearches = [];
      if (user.savedSearches.length >= 20) {
        return res.status(400).json({ message: 'You reached the limit of saved searches (20)' });
      }
      user.savedSearches.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: trimmedName,
        filters: sanitized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await patchUser(decoded.userId, { savedSearches: user.savedSearches });
      return res.status(201).json({ savedSearches: toResponse() });
    }

    if (req.method === 'PUT') {
      if (!(await enforceRateLimit(writeLimiter, req, res))) {
        return;
      }
      const { id, name, filters } = req.body || {};
      if (!id) {
        return res.status(400).json({ message: 'Valid id is required' });
      }
      const index = (user.savedSearches || []).findIndex((entry) => String(entry.id || entry._id) === String(id));
      const entry = index >= 0 ? user.savedSearches[index] : null;
      if (!entry) {
        return res.status(404).json({ message: 'Saved search not found' });
      }
      if (typeof name === 'string') {
        const trimmed = name.trim();
        if (!trimmed) {
          return res.status(400).json({ message: 'Name cannot be empty' });
        }
        if (trimmed.length > 60) {
          return res.status(400).json({ message: 'Name too long (max 60 characters)' });
        }
        entry.name = trimmed;
      }
      if (filters && typeof filters === 'object') {
        entry.filters = sanitizeFilters(filters);
      }
      entry.updatedAt = new Date().toISOString();
      user.savedSearches[index] = entry;
      await patchUser(decoded.userId, { savedSearches: user.savedSearches });
      return res.status(200).json({ savedSearches: toResponse() });
    }

    if (req.method === 'DELETE') {
      if (!(await enforceRateLimit(writeLimiter, req, res))) {
        return;
      }
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ message: 'Valid id is required' });
      }
      const before = user.savedSearches?.length || 0;
      user.savedSearches = (user.savedSearches || []).filter((entry) => String(entry.id || entry._id) !== String(id));
      if ((user.savedSearches?.length || 0) === before) {
        return res.status(404).json({ message: 'Saved search not found' });
      }
      await patchUser(decoded.userId, { savedSearches: user.savedSearches });
      return res.status(200).json({ savedSearches: toResponse() });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Saved searches API error:', error);
    return res.status(500).json({ message: 'Failed to process saved search request' });
  }
}
