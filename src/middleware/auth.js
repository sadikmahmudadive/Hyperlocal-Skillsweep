import { verifyToken } from '../lib/auth';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../lib/security';

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

function getQueryToken(req) {
  const raw = req?.query?.token;
  if (Array.isArray(raw)) return raw[0] || null;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export const requireAuth = (handler) => {
  return async (req, res) => {
    applyApiSecurityHeaders(res);

    // Allow preflight requests through without auth so handlers can respond.
    if (req.method === 'OPTIONS') {
      return handler(req, res);
    }
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      token = getCookie(req, 'sseso');
    }
    if (!token) {
      token = getQueryToken(req);
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

export const requireAuthRateLimited = (
  handler,
  {
    limit = 40,
    windowMs = 60_000,
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    keyPrefix = 'api',
  } = {}
) => {
  const limiter = createLimiter({
    limit,
    windowMs,
    keyGenerator: (req) => {
      const xfwd = req.headers['x-forwarded-for'];
      const ip = Array.isArray(xfwd)
        ? xfwd[0]
        : (xfwd ? xfwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown');
      const path = req.url?.split('?')[0] || 'unknown';
      const user = req.userId || 'anon';
      return `${keyPrefix}:${user}:${ip}:${path}:${req.method}`;
    },
  });

  return requireAuth(async (req, res) => {
    const m = (req.method || '').toUpperCase();
    if (methods.includes(m)) {
      const ok = await enforceRateLimit(limiter, req, res);
      if (!ok) return;
    }
    return handler(req, res);
  });
};