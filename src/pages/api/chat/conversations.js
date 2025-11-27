import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import User from '../../../models/User';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;

    // Best-effort presence update
    try {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() }, { new: false });
    } catch (_) {}

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name avatar rating lastActive isAvailable')
    .sort({ updatedAt: -1 })
    .limit(50);

    // Attach unreadCount per conversation (messages from others that are not read)
    const withUnread = conversations.map((c) => {
      const obj = c.toObject();
      const unreadCount = (obj.messages || []).reduce((acc, m) => {
        const senderId = typeof m.sender === 'object' && m.sender?._id ? m.sender._id : m.sender;
        return acc + (!m.read && String(senderId) !== String(userId) ? 1 : 0);
      }, 0);
      obj.unreadCount = unreadCount;
      if (obj.lastMessage && typeof obj.lastMessage === 'object' && !Array.isArray(obj.lastMessage)) {
        obj.lastMessage = {
          ...obj.lastMessage,
          sender: obj.lastMessage.sender ? String(obj.lastMessage.sender) : null
        };
      } else {
        obj.lastMessage = null;
      }
      return obj;
    });

    res.status(200).json({ conversations: withUnread });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
}

export default requireAuth(handler);