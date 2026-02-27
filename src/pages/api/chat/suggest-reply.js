import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getConversationById, getUsersByIds } from '../../../lib/firestoreStore';

function normalizeSuggestions(list) {
  const arr = Array.isArray(list) ? list : [];
  const unique = [];
  const seen = new Set();
  for (const item of arr) {
    const text = String(item || '').trim().replace(/\s+/g, ' ');
    if (!text) continue;
    const normalized = text.slice(0, 160);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
    if (unique.length >= 3) break;
  }
  return unique;
}

function fallbackSuggestions(lastIncomingText = '', skillTopic = '') {
  const topic = String(skillTopic || '').trim();
  const incoming = String(lastIncomingText || '').trim().toLowerCase();

  const suggestions = [];
  if (incoming.includes('when') || incoming.includes('time') || incoming.includes('schedule')) {
    suggestions.push('I am free this evening. Does 7:00 PM work for you?');
    suggestions.push('Can you share 2-3 time slots that work for you?');
  }
  if (incoming.includes('price') || incoming.includes('offer') || incoming.includes('cost')) {
    suggestions.push('I can offer a fair rate and we can adjust based on the session scope.');
    suggestions.push('Tell me your budget range and I will propose the best option.');
  }
  if (topic) {
    suggestions.push(`Yes, let us continue with ${topic}. What is your exact goal for this session?`);
  }

  suggestions.push('Sounds good. Please share your preferred time and key expectations.');
  suggestions.push('Great, I can help. What outcome do you want by the end of the session?');

  return normalizeSuggestions(suggestions).slice(0, 3);
}

async function generateWithOpenAI({ prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You generate concise, friendly chat reply suggestions for a local skill exchange app. Return strict JSON: {"suggestions":["...","...","..."]}. Keep each under 140 chars, no emojis unless needed, and do not include markdown.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    return normalizeSuggestions(parsed?.suggestions);
  } catch (_) {
    return null;
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const userId = String(req.userId);
    const { conversationId } = req.body || {};

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const participants = (conversation.participants || []).map(String);
    if (!participants.includes(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const users = await getUsersByIds(participants);
    const userMap = new Map(users.map((u) => [String(u.id || u._id), u]));

    const recentMessages = (conversation.messages || [])
      .filter((m) => (m.type || 'text') === 'text')
      .slice(-12)
      .map((m) => {
        const senderId = typeof m.sender === 'object' ? String(m.sender?._id || m.sender?.id || '') : String(m.sender || '');
        const role = senderId === userId ? 'me' : 'them';
        const senderName = userMap.get(senderId)?.name || role;
        return `${senderName} (${role}): ${String(m.content || '').trim()}`;
      })
      .filter(Boolean);

    const lastIncoming = (conversation.messages || [])
      .slice()
      .reverse()
      .find((m) => {
        const senderId = typeof m.sender === 'object' ? String(m.sender?._id || m.sender?.id || '') : String(m.sender || '');
        return senderId && senderId !== userId && (m.type || 'text') === 'text';
      });

    const prompt = [
      `Skill topic: ${conversation.skillTopic || 'General'}`,
      'Recent chat context:',
      recentMessages.length ? recentMessages.join('\n') : 'No recent messages',
      'Generate 3 natural reply options for me to send next.',
    ].join('\n\n');

    let suggestions = await generateWithOpenAI({ prompt });
    if (!suggestions || suggestions.length === 0) {
      suggestions = fallbackSuggestions(lastIncoming?.content || '', conversation.skillTopic || '');
    }

    return res.status(200).json({ suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    console.error('Suggest reply error:', error);
    return res.status(500).json({ message: 'Error generating suggestions' });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.chatSuggestWrite,
  methods: ['POST'],
  keyPrefix: 'chat:suggest',
});
