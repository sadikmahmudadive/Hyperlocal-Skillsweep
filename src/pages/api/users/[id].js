import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const { id } = req.query;

    // Validate ID format
    if (!id || id === 'undefined') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(id)
      .select('-password -email') // Exclude sensitive information
      .populate('reviews.reviewer', 'name avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate average rating if not already calculated
    if (user.reviews && user.reviews.length > 0 && !user.rating?.average) {
      const averageRating = user.reviews.reduce((sum, review) => sum + review.rating, 0) / user.reviews.length;
      user.rating = {
        average: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        count: user.reviews.length
      };
      await user.save();
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Error fetching user profile' });
  }
}