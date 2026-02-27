import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { addConversationMessage, getConversationById, getUserById, getUsersByIds } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const { conversationId } = req.query;
      let { limit, before } = req.query;
      const userId = req.userId;

      limit = Math.max(1, Math.min(parseInt(limit || '30', 10) || 30, 100));
      const beforeDate = before ? new Date(before) : null;

      const conversation = await getConversationById(conversationId);

      if (!conversation || !(conversation.participants || []).map(String).includes(String(userId))) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Sort ascending by createdAt and apply cursor pagination
      const sorted = (conversation.messages || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const filtered = beforeDate ? sorted.filter(m => new Date(m.createdAt) < beforeDate) : sorted;
      const total = filtered.length;
      const start = Math.max(0, total - limit);
      const page = filtered.slice(start);
      const hasMore = total > page.length;
      const nextCursor = page.length ? page[0].createdAt : null;

      // Populate sender minimal info for this page
      const senderIds = Array.from(new Set(page.map(m => String(m.sender))));
      const senders = await getUsersByIds(senderIds);
      const sMap = new Map(senders.map(u => [String(u.id || u._id), { _id: u.id || u._id, name: u.name, avatar: u.avatar }]));
      const shaped = page.map(m => ({
        _id: m._id,
        sender: sMap.get(String(m.sender)) || { _id: m.sender },
        content: m.content,
        createdAt: m.createdAt,
        read: m.read,
        type: m.type
      }));

      res.status(200).json({ messages: shaped, hasMore, nextCursor });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching messages' });
    }
  } else if (req.method === 'POST') {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const { conversationId, content, type } = req.body;
      const userId = req.userId;

      const conversation = await getConversationById(conversationId);

      if (!conversation || !(conversation.participants || []).map(String).includes(String(userId))) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const updated = await addConversationMessage(conversationId, {
        sender: userId,
        content,
        read: false,
        type: type || 'text'
      });
      const savedMessage = updated?.lastMessage;
      const senderUser = await getUserById(userId);
      const shapedMessage = {
        ...(savedMessage || {}),
        sender: senderUser
          ? { _id: senderUser.id || senderUser._id, name: senderUser.name, avatar: senderUser.avatar }
          : { _id: String(userId) }
      };

      try {
        notifyUsers((conversation.participants || []).map(p => String(p)), 'message', {
          conversationId,
          message: shapedMessage
        });
      } catch (_) {}

      res.status(201).json({ message: shapedMessage });
    } catch (error) {
      res.status(500).json({ message: 'Error sending message' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatMessagesWrite,
  methods: ['POST'],
  keyPrefix: 'chat:messages'
});