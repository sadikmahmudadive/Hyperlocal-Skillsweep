import { verifyToken } from '../lib/auth';

function getCookie(req, name) {
  const header = req.headers?.cookie || '';
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export const requireAuth = (handler) => {
  return async (req, res) => {
    // Allow preflight requests through without auth so handlers can respond.
    if (req.method === 'OPTIONS') {
      return handler(req, res);
    }
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      token = getCookie(req, 'sseso');
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