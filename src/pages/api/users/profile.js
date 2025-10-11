import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const updateData = req.body;

    // Validate required fields
    if (!updateData.name || !updateData.name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!updateData.address || !updateData.address.trim()) {
      return res.status(400).json({ message: 'Address is required' });
    }

    // Remove sensitive fields
    const { 
      password, 
      email, 
      _id, 
      credits, 
      rating, 
      reviews,
      skillsOffered,
      skillsNeeded,
      isVerified,
      lastActive,
      createdAt,
      updatedAt,
      ...safeUpdateData 
    } = updateData;

    // Handle avatar - generate if not provided but name changed
    if (!safeUpdateData.avatar && updateData.name) {
      const userName = updateData.name.trim();
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0ea5e9&color=fff&size=128&bold=true`;
      safeUpdateData.avatar = {
        url: avatarUrl,
        public_id: `avatar_${userId}`
      };
    }

    // Handle preferences
    if (safeUpdateData.preferences) {
      safeUpdateData.preferences = {
        ...safeUpdateData.preferences,
        notifications: safeUpdateData.preferences.notifications || { email: true, push: true }
      };
    } else {
      const existingUser = await User.findById(userId);
      safeUpdateData.preferences = existingUser.preferences;
    }

    // Validate inputs
    if (safeUpdateData.bio && safeUpdateData.bio.length > 500) {
      return res.status(400).json({ message: 'Bio must be less than 500 characters' });
    }

    if (safeUpdateData.preferences?.maxDistance) {
      const maxDistance = parseInt(safeUpdateData.preferences.maxDistance);
      if (isNaN(maxDistance) || maxDistance < 1 || maxDistance > 100) {
        return res.status(400).json({ message: 'Max distance must be between 1 and 100 kilometers' });
      }
      safeUpdateData.preferences.maxDistance = maxDistance;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: safeUpdateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed',
        errors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'A user with this email already exists' 
      });
    }
    
    res.status(500).json({ message: 'Error updating profile' });
  }
}

export default requireAuth(handler);