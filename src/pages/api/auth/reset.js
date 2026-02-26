import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { signToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUserById, patchUser } from '../../../lib/firestoreStore';

const resetLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.authReset,
});

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (!(await enforceRateLimit(resetLimiter, req, res))) {
    return;
  }
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });
    if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'Server misconfiguration' });
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    const user = await getUserById(payload.userId);
    if (!user) return res.status(400).json({ message: 'Invalid token (no user)' });

    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const hashed = await bcrypt.hash(password, 12);
    await patchUser(payload.userId, { password: hashed });

    // Optionally issue a new JWT cookie so user is logged in after reset
    const newToken = signToken(user.id || user._id);
    res.setHeader('Set-Cookie', cookie.serialize('sseso', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    }));

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
