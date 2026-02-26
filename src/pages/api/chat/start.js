import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
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
    const findFilter = { participants: { $all: [userId, otherParticipantId] } };
    if (typeof skillTopic === 'string' && skillTopic.trim() !== '') {
      findFilter.skillTopic = skillTopic;
    }
    let conversation = await Conversation.findOne(findFilter);

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [userId, otherParticipantId],
        skillTopic,
        messages: []
      });
    }

    // Add initial message
    if (initialMessage) {
      conversation.messages.push({
        sender: userId,
        content: initialMessage,
        read: false
      });
      conversation.lastMessage = conversation.messages[conversation.messages.length - 1];
    }

    await conversation.save();
    await conversation.populate('participants', 'name avatar rating lastActive isAvailable');

    try {
      notifyUsers(conversation.participants.map(p => String(p._id || p)), 'conversation-start', {
        conversationId: conversation._id,
      });
    } catch (_) {}

    res.status(200).json({ conversation });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ message: 'Error starting conversation' });
  }
}

export default requireAuthRateLimited(handler, {
  limit: 25,
  windowMs: 60_000,
  methods: ['POST'],
  keyPrefix: 'chat:start'
});