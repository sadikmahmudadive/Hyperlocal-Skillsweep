// Simple in-memory sliding-window rate limiter
// NOTE: For serverless environments, memory is per-instance; consider an external store (Redis) for production.

const store = new Map(); // key -> { count, resetAt }

function getClientKey(req, keyGenerator) {
  if (typeof keyGenerator === 'function') return keyGenerator(req);
  const xfwd = req.headers['x-forwarded-for'];
  const ip = Array.isArray(xfwd) ? xfwd[0] : (xfwd ? xfwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown');
  const path = req.url?.split('?')[0] || 'unknown';
  return `${ip}:${path}`;
}

export function rateLimit({ limit = 60, windowMs = 60_000, keyGenerator } = {}) {
  return {
    async check(req) {
      const now = Date.now();
      const key = getClientKey(req, keyGenerator);
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }
      if (entry.count >= limit) {
        const retryAfter = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
        const err = new Error('Too many requests');
        err.status = 429;
        err.retryAfter = retryAfter;
        throw err;
      }
      entry.count += 1;
      store.set(key, entry);
    }
  };
}

export default rateLimit;
