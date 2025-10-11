import dbConnect from '../../../lib/dbConnect';

export default async function handler(req, res) {
  const start = Date.now();
  let db = { connected: false, name: null, host: null };
  try {
    const conn = await dbConnect();
    const c = conn.connection;
    db = { connected: c?.readyState === 1, name: c?.name || null, host: c?.host || null };
  } catch (e) {
    db = { connected: false, error: e?.message || 'db error' };
  }
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    now: new Date().toISOString(),
    latencyMs: Date.now() - start,
    db,
  });
}
