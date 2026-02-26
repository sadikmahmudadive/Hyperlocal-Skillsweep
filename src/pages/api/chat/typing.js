import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { conversationId, isTyping } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conv = await Conversation.findById(conversationId).select('participants');
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    if (!conv.participants.map(String).includes(String(userId))) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    try {
      notifyUsers(conv.participants.map(p => String(p)), 'typing', {
        conversationId,
        userId,
        isTyping: !!isTyping,
        at: Date.now()
      });
    } catch (_) {}

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Typing indicator error:', error);
    res.status(500).json({ message: 'Error broadcasting typing status' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatTypingWrite,
  methods: ['POST'],
  keyPrefix: 'chat:typing'
});
