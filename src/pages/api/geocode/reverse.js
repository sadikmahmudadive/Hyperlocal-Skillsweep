import { rateLimit } from '../../../lib/rateLimit';

const limiter = rateLimit({ limit: 30, windowMs: 60_000 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    try { await limiter.check(req); } catch (e) { return res.status(e.status || 429).json({ message: e.message || 'Too many requests', retryAfter: e.retryAfter }); }
    const { lng, lon, lat } = req.query;
    const longitude = typeof lng !== 'undefined' ? Number(lng) : (typeof lon !== 'undefined' ? Number(lon) : null);
    const latitude = typeof lat !== 'undefined' ? Number(lat) : null;
    if (!isFinite(longitude) || !isFinite(latitude)) {
      return res.status(400).json({ message: 'Missing or invalid lng/lat parameters' });
    }
    const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return res.status(500).json({ message: 'Geocoding token not configured' });
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(to);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ message: 'Reverse geocoding failed', detail: txt });
    }
    const data = await r.json();
    const feature = Array.isArray(data?.features) && data.features[0] ? data.features[0] : null;
    if (!feature) return res.status(200).json({ place_name: null, feature: null });
    const safe = {
      id: feature.id,
      place_name: feature.place_name,
      center: feature.center,
      bbox: feature.bbox || null,
      context: feature.context || [],
      text: feature.text || null
    };
    return res.status(200).json({ place_name: safe.place_name, feature: safe });
  } catch (e) {
    console.error('Reverse geocode proxy error', e);
    return res.status(500).json({ message: 'Internal geocode error' });
  }
}
