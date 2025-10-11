import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import mongoose from 'mongoose';
import { getTokenFromRequest, verifyToken } from '../../../lib/auth';

const basicUserProjection = 'name avatar rating skillsOffered credits location bio';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    await dbConnect();
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.method === 'GET') {
      const favorites = await User.find({ _id: { $in: currentUser.favorites || [] } })
        .select(basicUserProjection)
        .lean();

      return res.status(200).json({
        ids: (currentUser.favorites || []).map((id) => id.toString()),
        favorites: favorites.map((fav) => ({
          ...fav,
          id: fav._id.toString()
        }))
      });
    }

    const { providerId } = req.body || {};
    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ message: 'Valid providerId is required' });
    }

    if (providerId === decoded.userId) {
      return res.status(400).json({ message: 'You cannot favorite yourself' });
    }

    const provider = await User.findById(providerId).select(basicUserProjection).lean();
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    if (req.method === 'POST') {
      currentUser.favorites = currentUser.favorites || [];
      if (!currentUser.favorites.some((favId) => favId.toString() === providerId)) {
        currentUser.favorites.push(new mongoose.Types.ObjectId(providerId));
        await currentUser.save();
      }

      return res.status(200).json({
        ids: currentUser.favorites.map((id) => id.toString()),
        favorite: { ...provider, id: provider._id.toString() }
      });
    }

    if (req.method === 'DELETE') {
      const before = (currentUser.favorites || []).length;
      currentUser.favorites = (currentUser.favorites || []).filter((favId) => favId.toString() !== providerId);
      if (currentUser.favorites.length !== before) {
        await currentUser.save();
      }
      return res.status(200).json({ ids: currentUser.favorites.map((id) => id.toString()) });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Favorites API error:', error);
    return res.status(500).json({ message: 'Failed to process favorites request' });
  }
}
