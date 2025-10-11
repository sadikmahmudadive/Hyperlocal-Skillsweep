import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    res.status(401).json({ message: 'Invalid token' });
  }
}