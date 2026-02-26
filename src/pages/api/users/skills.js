import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { addUserSkill, removeUserSkill, toUserResponse } from '../../../lib/userStore';

async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { type, skill } = req.body;
      const userId = req.userId;

      const user = await addUserSkill(userId, type, skill);

      res.status(200).json({ 
        message: 'Skill added successfully',
        user: toUserResponse(user)
      });
    } catch (error) {
      res.status(500).json({ message: 'Error adding skill' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { type, skillId } = req.body;
      const userId = req.userId;

      const user = await removeUserSkill(userId, type, skillId);

      res.status(200).json({ 
        message: 'Skill removed successfully',
        user: toUserResponse(user)
      });
    } catch (error) {
      res.status(500).json({ message: 'Error removing skill' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.usersSkillsWrite,
  methods: ['POST', 'DELETE'],
  keyPrefix: 'users:skills'
});