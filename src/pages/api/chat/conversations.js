import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUsersByIds, listConversationsForUser, patchUser } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const userId = req.userId;

    // Best-effort presence update
    try {
      await patchUser(userId, { lastActive: new Date().toISOString() });
    } catch (_) {}

    const conversations = await listConversationsForUser(userId);
    const participantIds = Array.from(new Set(conversations.flatMap((c) => c.participants || []).map(String)));
    const participants = await getUsersByIds(participantIds);
    const participantMap = new Map(participants.map((p) => [String(p.id || p._id), p]));

    // Attach unreadCount per conversation (messages from others that are not read)
    const withUnread = conversations.map((obj) => {
      const unreadCount = (obj.messages || []).reduce((acc, m) => {
        const senderId = typeof m.sender === 'object' && m.sender?._id ? m.sender._id : m.sender;
        return acc + (!m.read && String(senderId) !== String(userId) ? 1 : 0);
      }, 0);
      const normalizedParticipants = (obj.participants || []).map((pid) => participantMap.get(String(pid)) || { _id: String(pid), id: String(pid) });
      const normalized = {
        ...obj,
        participants: normalizedParticipants,
      };
      normalized.unreadCount = unreadCount;
      if (normalized.lastMessage && typeof normalized.lastMessage === 'object' && !Array.isArray(normalized.lastMessage)) {
        normalized.lastMessage = {
          ...normalized.lastMessage,
          sender: normalized.lastMessage.sender ? String(normalized.lastMessage.sender) : null
        };
      } else {
        normalized.lastMessage = null;
      }
      return normalized;
    });

    res.status(200).json({ conversations: withUnread });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
}

export default requireAuthRateLimited(handler, { ...RATE_LIMIT_PROFILES.chatConversationsRead,
  methods: ['GET'],
  keyPrefix: 'chat:conversations'
});