import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getConversationById, patchConversation } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation || !(conversation.participants || []).map(String).includes(String(userId))) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    let updated = false;
    const nextMessages = (conversation.messages || []).map((m) => {
      if (!m.read && String(m.sender) !== String(userId)) {
        updated = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (updated) {
      const lastMessage = conversation.lastMessage && !conversation.lastMessage.read && String(conversation.lastMessage.sender) !== String(userId)
        ? { ...conversation.lastMessage, read: true }
        : conversation.lastMessage;
      await patchConversation(conversationId, { messages: nextMessages, lastMessage });
    }

    if (updated) {
      try {
        notifyUsers((conversation.participants || []).map((p) => String(p)), 'read', {
          conversationId,
          readerId: String(userId),
          at: Date.now(),
        });
      } catch (_) {}
    }

    return res.status(200).json({ success: true, updated });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ message: 'Error marking messages as read' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatReadWrite,
  methods: ['PATCH', 'POST'],
  keyPrefix: 'chat:read'
});
