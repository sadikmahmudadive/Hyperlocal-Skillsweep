import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { signToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { findUserByEmail, toUserResponse, updateUserLastActive } from '../../../lib/userStore';

const FIREBASE_AUTH_API_KEY = process.env.FIREBASE_AUTH_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function verifyWithFirebaseAuth(email, password) {
  if (!FIREBASE_AUTH_API_KEY) return true;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_AUTH_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    }
  );

  if (response.ok) return true;

  try {
    const payload = await response.json();
    const code = payload?.error?.message;
    if (['INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'USER_DISABLED', 'INVALID_LOGIN_CREDENTIALS'].includes(code)) {
      return false;
    }
  } catch (_) {}

  return false;
}

const loginLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.authLogin,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return `${ip}:auth:login:${email}`;
  },
});

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(loginLimiter, req, res))) {
    return;
  }

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isFirebaseAuthValid = await verifyWithFirebaseAuth(email, password);
    if (!isFirebaseAuthValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    let token;
    try {
      token = signToken(user.id || user._id);
    } catch (tokenError) {
      console.error('Login token error:', tokenError);
      return res.status(500).json({ message: 'Server authentication configuration error' });
    }

    // Update last active
    await updateUserLastActive(user.id || user._id);

    // Return user data without password
    const userData = toUserResponse(user);

    // Set HttpOnly signed cookie for SSE auth (non-HTTP signed: we use JWT as value; integrity from JWT signature)
    res.setHeader('Set-Cookie', cookie.serialize('sseso', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    }));

    res.status(200).json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}