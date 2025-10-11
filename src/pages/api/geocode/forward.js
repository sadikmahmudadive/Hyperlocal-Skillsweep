import { rateLimit } from '../../../lib/rateLimit';

const limiter = rateLimit({ limit: 30, windowMs: 60_000 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  try {
    try { await limiter.check(req); } catch (e) { return res.status(e.status || 429).json({ message: e.message || 'Too many requests', retryAfter: e.retryAfter }); }
    const q = req.query.q || req.query.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ message: 'Missing query parameter q' });
    }
    const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return res.status(500).json({ message: 'Geocoding token not configured' });
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q.trim())}.json?access_token=${encodeURIComponent(token)}&limit=5`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(to);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ message: 'Geocoding failed', detail: txt });
    }
    const data = await r.json();
    // Return minimal safe payload
    const features = Array.isArray(data?.features) ? data.features.map((f) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      bbox: f.bbox || null,
      relevance: f.relevance,
      context: f.context || [],
    })) : [];
    return res.status(200).json({ features });
  } catch (e) {
    console.error('Geocode proxy error', e);
    return res.status(500).json({ message: 'Internal geocode error' });
  }
}
