import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import { requireAuth } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
  const { recipientId, skillTopic, initialMessage } = req.body;

    // Check if conversation already exists
    const findFilter = { participants: { $all: [userId, recipientId] } };
    if (typeof skillTopic === 'string' && skillTopic.trim() !== '') {
      findFilter.skillTopic = skillTopic;
    }
    let conversation = await Conversation.findOne(findFilter);

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [userId, recipientId],
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
      conversation.lastMessage = conversation.messages[conversation.messages.length - 1]._id;
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

export default requireAuth(handler);