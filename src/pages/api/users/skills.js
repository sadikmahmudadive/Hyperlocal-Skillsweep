import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await dbConnect();
      
      const { type, skill } = req.body;
      const userId = req.userId;

      const updateField = type === 'offered' ? 'skillsOffered' : 'skillsNeeded';
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $push: { [updateField]: skill } },
        { new: true }
      ).select('-password');

      res.status(200).json({ 
        message: 'Skill added successfully',
        user 
      });
    } catch (error) {
      res.status(500).json({ message: 'Error adding skill' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await dbConnect();
      
      const { type, skillId } = req.body;
      const userId = req.userId;

      const updateField = type === 'offered' ? 'skillsOffered' : 'skillsNeeded';
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $pull: { [updateField]: { _id: skillId } } },
        { new: true }
      ).select('-password');

      res.status(200).json({ 
        message: 'Skill removed successfully',
        user 
      });
    } catch (error) {
      res.status(500).json({ message: 'Error removing skill' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default requireAuth(handler);