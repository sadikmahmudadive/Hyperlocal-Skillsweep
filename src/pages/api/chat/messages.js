import dbConnect from '../../../lib/dbConnect';
import Conversation from '../../../models/Conversation';
import User from '../../../models/User';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { notifyUsers } from '../../../lib/sse';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      await dbConnect();
      const { conversationId } = req.query;
      let { limit, before } = req.query;
      const userId = req.userId;

      limit = Math.max(1, Math.min(parseInt(limit || '30', 10) || 30, 100));
      const beforeDate = before ? new Date(before) : null;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      }).select('messages participants');

      if (!conversation) {
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
      const senders = await User.find({ _id: { $in: senderIds } }).select('name avatar');
      const sMap = new Map(senders.map(u => [String(u._id), { _id: u._id, name: u.name, avatar: u.avatar }]));
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
      await dbConnect();
      const { conversationId, content, type } = req.body;
      const userId = req.userId;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const newMessage = {
        sender: userId,
        content,
        read: false,
        type: type || 'text'
      };

      conversation.messages.push(newMessage);
      conversation.lastMessage = conversation.messages[conversation.messages.length - 1];
      await conversation.save();

      // Populate sender info for the response
      await conversation.populate('messages.sender', 'name avatar');

      const savedMessage = conversation.messages[conversation.messages.length - 1];

      try {
        notifyUsers(conversation.participants.map(p => String(p)), 'message', {
          conversationId: conversation._id,
          message: savedMessage
        });
      } catch (_) {}

      res.status(201).json({ message: savedMessage });
    } catch (error) {
      res.status(500).json({ message: 'Error sending message' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default requireAuthRateLimited(handler, {
  limit: 60,
  windowMs: 60_000,
  methods: ['POST'],
  keyPrefix: 'chat:messages'
});