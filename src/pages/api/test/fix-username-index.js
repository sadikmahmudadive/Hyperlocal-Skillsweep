import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

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
    await dbConnect();

    const coll = (await User.db.db).collection(User.collection.name);
    const before = await coll.indexes();

    const usernameIndex = before.find(ix => (ix.key && ix.key.username === 1) || ix.name === 'username_1');
    let action = 'none';
    let dropped = null;

    if (usernameIndex) {
      try {
        await coll.dropIndex(usernameIndex.name || 'username_1');
        action = 'dropped';
        dropped = usernameIndex.name || 'username_1';
      } catch (e) {
        action = 'drop-failed';
        console.error('Failed to drop username index', e);
      }
    }

    const after = await coll.indexes();
    return res.status(200).json({
      message: 'Checked users indexes',
      action,
      dropped,
      before,
      after
    });
  } catch (e) {
    console.error('fix-username-index error', e);
    return res.status(500).json({ message: 'Error fixing index', error: e?.message });
  }
}
