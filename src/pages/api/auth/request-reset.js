import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await dbConnect();
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const norm = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: norm });
    // Always return success to avoid revealing account existence
    if (!user) {
      return res.status(200).json({ message: 'If an account exists, you will receive reset instructions shortly.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET missing');
      return res.status(500).json({ message: 'Server misconfiguration' });
    }
    // Create a short-lived token (1 hour)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const base = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const resetLink = `${base.replace(/\/$/, '')}/auth/reset?token=${token}`;

    // In production, you'd send an email with the resetLink here (e.g., via SendGrid, Mailgun)
    if (process.env.NODE_ENV === 'production') {
      // TODO: send email
      console.log('Reset link (production):', resetLink);
      return res.status(200).json({ message: 'If an account exists, you will receive reset instructions shortly.' });
    }

    // In development, return the link to make it easy to test
    return res.status(200).json({ message: 'Reset link generated (development)', resetLink });
  } catch (err) {
    console.error('Request reset error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
