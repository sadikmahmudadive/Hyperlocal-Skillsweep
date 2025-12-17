import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import { requireAuth } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';

async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    let updated = false;
    conversation.messages.forEach((m) => {
      if (!m.read && String(m.sender) !== String(userId)) {
        m.read = true;
        updated = true;
      }
    });

    if (updated) {
      // Ensure lastMessage reflects updated read state when applicable
      if (
        conversation.lastMessage &&
        !conversation.lastMessage.read &&
        String(conversation.lastMessage.sender) !== String(userId)
      ) {
        conversation.lastMessage.read = true;
      }
      await conversation.save();
    }

    if (updated) {
      try {
        notifyUsers(conversation.participants.map((p) => String(p)), 'read', {
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

export default requireAuth(handler);
