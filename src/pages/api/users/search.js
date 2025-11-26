import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { rateLimit } from '../../../lib/rateLimit';

const limiter = rateLimit({ limit: 60, windowMs: 60_000 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    try { await limiter.check(req); } catch (e) {
      return res.status(e.status || 429).json({ message: e.message || 'Too many requests', retryAfter: e.retryAfter });
    }
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