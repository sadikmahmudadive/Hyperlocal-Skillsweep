import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getFirestoreDb } from '../../../lib/firebaseAdmin';

const limiter = createLimiter(RATE_LIMIT_PROFILES.testHealth);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(limiter, req, res))) return;

  const start = Date.now();
  let db = { connected: false, name: null, host: null };
  try {
    const fs = getFirestoreDb();
    await fs.collection('health').limit(1).get();
    db = { connected: true, name: process.env.FIREBASE_PROJECT_ID || null, host: 'firestore.googleapis.com' };
  } catch (e) {
    db = { connected: false, error: e?.message || 'db error' };
  }
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    now: new Date().toISOString(),
    latencyMs: Date.now() - start,
    db,
  });
}
