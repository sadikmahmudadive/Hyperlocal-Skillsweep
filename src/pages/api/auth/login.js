import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { signToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

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
    await dbConnect();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
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

    let token;
    try {
      token = signToken(user._id);
    } catch (tokenError) {
      console.error('Login token error:', tokenError);
      return res.status(500).json({ message: 'Server authentication configuration error' });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Return user data without password
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      bio: user.bio,
      address: user.address,
      avatar: user.avatar,
      rating: user.rating,
      favorites: user.favorites?.map((fav) => fav.toString()) || [],
      savedSearches: (user.savedSearches || []).map((entry) => ({
        id: entry._id?.toString(),
        name: entry.name,
        filters: entry.filters
      }))
    };

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