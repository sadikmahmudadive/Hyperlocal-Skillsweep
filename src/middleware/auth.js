import { verifyToken } from '../lib/auth';
import cookie from 'cookie';

export const requireAuth = (handler) => {
  return async (req, res) => {
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.headers.cookie) {
      try {
        const parsed = cookie.parse(req.headers.cookie || '');
        token = parsed.sseso || null;
      } catch {}
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

  const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.userId = decoded.userId;
    return handler(req, res);
  };
};