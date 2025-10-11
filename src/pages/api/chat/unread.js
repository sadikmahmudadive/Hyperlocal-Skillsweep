import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await dbConnect();
    const userId = String(req.userId);
    const conversations = await Conversation.find({ participants: userId }, { messages: 1 }).lean();
    let total = 0;
    const perConversation = {};
    for (const c of conversations) {
      const count = (c.messages || []).reduce((acc, m) => acc + (!m.read && String(m.sender) !== userId ? 1 : 0), 0);
      if (count > 0) {
        perConversation[String(c._id)] = count;
        total += count;
      }
    }
    res.status(200).json({ total, perConversation });
  } catch (e) {
    console.error('Unread count error:', e);
    res.status(500).json({ message: 'Failed to get unread counts' });
  }
}

export default requireAuth(handler);
