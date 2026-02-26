import cookie from 'cookie';
import { applyApiSecurityHeaders } from '../../../lib/security';

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  // Clear SSE cookie
  res.setHeader('Set-Cookie', cookie.serialize('sseso', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  }));
  res.status(200).json({ success: true });
}
