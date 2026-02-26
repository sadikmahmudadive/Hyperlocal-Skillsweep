import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { applyApiSecurityHeaders } from '../../../lib/security';

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const token = getTokenFromRequest(req) || (() => {
      const header = req.headers?.cookie || '';
      const part = header.split(';').map((v) => v.trim()).find((v) => v.startsWith('sseso='));
      return part ? decodeURIComponent(part.slice('sseso='.length)) : null;
    })();
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      bio: user.bio,
      address: user.address,
      avatar: user.avatar,
      rating: user.rating,
      skillsOffered: user.skillsOffered,
      skillsNeeded: user.skillsNeeded,
      lastActive: user.lastActive,
      location: user.location,
      favorites: user.favorites?.map((fav) => fav.toString()) || [],
      savedSearches: (user.savedSearches || []).map((entry) => ({
        id: entry._id?.toString(),
        name: entry.name,
        filters: entry.filters
      }))
    };

    res.status(200).json(userData);
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}