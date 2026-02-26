import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { listConversationsForUser } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const userId = String(req.userId);
    const conversations = await listConversationsForUser(userId);
    let total = 0;
    const perConversation = {};
    for (const c of conversations) {
      const count = (c.messages || []).reduce((acc, m) => acc + (!m.read && String(m.sender) !== userId ? 1 : 0), 0);
      if (count > 0) {
        perConversation[String(c.id || c._id)] = count;
        total += count;
      }
    }
    // Keep response compatible with older callers
    res.status(200).json({
      total,
      perConversation,
      unreadCounts: perConversation,
      unreadCount: total,
    });
  } catch (e) {
    console.error('Unread count error:', e);
    res.status(500).json({ message: 'Failed to get unread counts' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatUnreadRead,
  methods: ['GET'],
  keyPrefix: 'chat:unread'
});
