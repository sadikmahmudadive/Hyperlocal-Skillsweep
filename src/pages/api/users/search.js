import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

const limiter = createLimiter(RATE_LIMIT_PROFILES.publicSearch);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!(await enforceRateLimit(limiter, req, res))) return;
    await dbConnect();

    const { query, category, distance = 10, lat, lng } = req.query;

    let searchFilter = {
      isAvailable: { $ne: false } // Default to true if undefined
    };
    
    // Text search
    if (query) {
      searchFilter.$or = [
        { 'skillsOffered.name': { $regex: query, $options: 'i' } },
        { 'skillsNeeded.name': { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      searchFilter['skillsOffered.category'] = category;
    }

    // Geo search
    let users;
    if (lat && lng) {
      users = await User.find({
        ...searchFilter,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: distance * 1000 // Convert km to meters
          }
        }
      }).select('-password').limit(50);
    } else {
      users = await User.find(searchFilter).select('-password').limit(50);
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}