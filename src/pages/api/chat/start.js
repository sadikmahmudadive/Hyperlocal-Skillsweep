import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { createConversation, findConversationByParticipants, getUsersByIds, addConversationMessage } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = req.userId;
    const {
      recipientId,
      participantId,
      skillTopic,
      initialMessage
    } = req.body;

    const otherParticipantId = recipientId || participantId;
    if (!otherParticipantId) {
      return res.status(400).json({ message: 'recipientId or participantId is required' });
    }
    if (String(otherParticipantId) === String(userId)) {
      return res.status(400).json({ message: 'Cannot start a conversation with yourself' });
    }

    // Check if conversation already exists
    let conversation = await findConversationByParticipants(userId, otherParticipantId, skillTopic);

    if (!conversation) {
      conversation = await createConversation({
        participants: [userId, otherParticipantId],
        skillTopic,
        messages: []
      });
    }

    // Add initial message
    if (initialMessage) {
      conversation = await addConversationMessage(conversation.id || conversation._id, {
        sender: userId,
        content: initialMessage,
        read: false
      });
    }

    const participantUsers = await getUsersByIds(conversation.participants || []);
    const conversationPayload = {
      ...conversation,
      participants: participantUsers,
    };

    try {
      notifyUsers((conversation.participants || []).map((p) => String(p)), 'conversation-start', {
        conversationId: conversation.id || conversation._id,
      });
    } catch (_) {}

    res.status(200).json({ conversation: conversationPayload });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ message: 'Error starting conversation' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatStartWrite,
  methods: ['POST'],
  keyPrefix: 'chat:start'
});