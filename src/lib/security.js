import { rateLimit } from './rateLimit';

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function applyApiSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export function createLimiter(options) {
  return rateLimit(options);
}

export async function enforceRateLimit(limiter, req, res) {
  try {
    await limiter.check(req);
    return true;
  } catch (error) {
    const retryAfter = Number(error?.retryAfter || 60);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(error?.status || 429).json({ message: 'Too many requests. Please try again later.' });
    return false;
  }
}

export function parseBase64Image(input, { maxBytes = DEFAULT_MAX_IMAGE_BYTES } = {}) {
  if (!input || typeof input !== 'string') {
    throw new Error('No image provided');
  }

  const dataUrlMatch = input.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\n\r]+)$/i);
  let mimeType = 'image/jpeg';
  let base64Data = input;

  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64Data = dataUrlMatch[3];
  } else if (input.startsWith('data:')) {
    throw new Error('Unsupported image format');
  }

  const normalized = base64Data.replace(/\s+/g, '');
  const rawBytes = Math.floor((normalized.length * 3) / 4);
  if (!rawBytes || rawBytes > maxBytes) {
    throw new Error('Image is too large');
  }

  return {
    mimeType,
    base64Data: normalized,
  };
}
