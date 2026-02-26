import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getFirestoreDb } from '../../../lib/firebaseAdmin';

const limiter = createLimiter(RATE_LIMIT_PROFILES.testFixUsernameIndex);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  // Allow GET or POST in development for convenience
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(limiter, req, res))) return;

  try {
    const db = getFirestoreDb();
    await db.collection('users').limit(1).get();
    return res.status(200).json({
      message: 'Firestore mode: Mongo username index fix is not applicable',
      action: 'noop',
      dropped: null,
      before: ['firestore:auto-indexes'],
      after: ['firestore:auto-indexes']
    });
  } catch (e) {
    console.error('fix-username-index error', e);
    return res.status(500).json({ message: 'Error fixing index', error: e?.message });
  }
}
