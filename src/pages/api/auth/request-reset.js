import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';
import sgMail from '@sendgrid/mail';

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

    // If SENDGRID_API_KEY is set, attempt to send the reset email (suitable for production)
    if (process.env.SENDGRID_API_KEY) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const from = process.env.SENDGRID_FROM || `no-reply@${process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') || 'example.com'}`;
        const msg = {
          to: norm,
          from,
          subject: 'Reset your SkillSwap password',
          text: `Use the link below to reset your password. This link expires in 1 hour.\n\n${resetLink}`,
          html: `<p>Use the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p>`
        };
        await sgMail.send(msg);
        console.log('Password reset email sent to', norm);
        return res.status(200).json({ message: 'If an account exists, you will receive reset instructions shortly.' });
      } catch (emailErr) {
        console.error('SendGrid error sending reset email:', emailErr);
        // Fall back to non-email behavior below so developers can still test
      }
    }

  // Return the link for development or if email sending failed so it can be used for testing
  return res.status(200).json({ message: 'Reset link generated (development)', resetLink });
  } catch (err) {
    console.error('Request reset error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
