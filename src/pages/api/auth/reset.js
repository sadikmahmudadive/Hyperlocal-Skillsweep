import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
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
    await dbConnect();
    const user = await User.findById(payload.userId);
    if (!user) return res.status(400).json({ message: 'Invalid token (no user)' });

    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hashed = await bcrypt.hash(password, 12);
    user.password = hashed;
    await user.save();

    // Optionally issue a new JWT cookie so user is logged in after reset
    const newToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.setHeader('Set-Cookie', cookie.serialize('sseso', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    }));

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
