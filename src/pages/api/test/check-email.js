import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getFirestoreDb } from '../../../lib/firebaseAdmin';

const limiter = createLimiter(RATE_LIMIT_PROFILES.testCheckEmail);

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(limiter, req, res))) return;

  try {
    const db = getFirestoreDb();

    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ message: 'email query is required' });
    const norm = email.toLowerCase();

    const allUsersSnap = await db.collection('users').limit(1000).get();
    const all = allUsersSnap.docs.map((d) => d.data());
    const exact = all.filter((u) => String(u.email || '') === email);
    const normExact = all.filter((u) => String(u.email || '') === norm);
    const insensitive = all.filter((u) => String(u.email || '').toLowerCase() === norm);

    res.status(200).json({
      query: { email, norm },
      matches: {
        exact: exact.map(d => d.email),
        normExact: normExact.map(d => d.email),
        insensitive: insensitive.map(d => d.email),
      },
      indexes: ['firestore:auto-indexes']
    });
  } catch (e) {
    console.error('check-email error', e);
    res.status(500).json({ message: 'error', error: e?.message });
  }
}


