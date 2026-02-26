import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { signToken } from '../../../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';

const registerLimiter = createLimiter({
  ...RATE_LIMIT_PROFILES.authRegister,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return `${ip}:auth:register:${email}`;
  },
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(registerLimiter, req, res))) {
    return;
  }

  try {
    await dbConnect();
    const { name, email, password, address, bio } = req.body || {};

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Normalize email for lookup (schema lowercases on save, but findOne should match too)
    const normEmail = String(email).trim().toLowerCase();

    // Check if user exists (case-insensitive to align with possible unique index collation)
    const existingUser = await User.findOne({ email: { $regex: `^${escapeRegExp(normEmail)}$`, $options: 'i' } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name: String(name).trim(),
      email: normEmail,
      password: hashedPassword,
      bio,
      credits: 2, // Starting bonus
      // Store address inside location to match schema
      location: address ? { address: String(address).trim() } : undefined,
    });

    const token = signToken(user._id);

    // Return user data without password
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      bio: user.bio,
      address: user.address,
      favorites: [],
      savedSearches: []
    };

    // Set HttpOnly cookie for SSE auth
    res.setHeader('Set-Cookie', cookie.serialize('sseso', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    }));

    res.status(201).json({
      message: 'User created successfully',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Duplicate key error (e.g., email unique)
    if (error && error.code === 11000) {
      const dupField = error.keyValue ? Object.keys(error.keyValue)[0] : 'email';
      const dupValue = error.keyValue ? error.keyValue[dupField] : undefined;
      if (process.env.NODE_ENV !== 'production') {
        console.error('Duplicate key details:', { dupField, dupValue });
      }
      return res.status(400).json({ message: `${dupField === 'email' ? 'Email' : dupField} already in use` });
    }
    // Mongoose validation error
    if (error && error.name === 'ValidationError') {
      const first = Object.values(error.errors)[0];
      return res.status(400).json({ message: first?.message || 'Invalid data' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}