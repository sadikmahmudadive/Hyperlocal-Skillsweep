import { requireAuthRateLimited } from '../../../middleware/auth';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { patchUser } from '../../../lib/firestoreStore';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await patchUser(req.userId, { lastActive: new Date().toISOString() });
    return res.status(200).json({ ok: true, at: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.presencePing,
  methods: ['POST'],
  keyPrefix: 'presence:ping'
});
