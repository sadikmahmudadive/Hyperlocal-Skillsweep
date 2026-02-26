import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { applyApiSecurityHeaders } from '../../../lib/security';
import { findUserById, toUserResponse, updateUserLastActive } from '../../../lib/userStore';

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = getTokenFromRequest(req) || (() => {
      const header = req.headers?.cookie || '';
      const part = header.split(';').map((v) => v.trim()).find((v) => v.startsWith('sseso='));
      return part ? decodeURIComponent(part.slice('sseso='.length)) : null;
    })();
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await updateUserLastActive(decoded.userId);
    const userData = toUserResponse(user);

    res.status(200).json(userData);
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}