import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';

export default async function handler(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ message: 'email query is required' });
    const norm = email.toLowerCase();

    const exact = await User.find({ email: email }).select('email');
    const normExact = await User.find({ email: norm }).select('email');
    const insensitive = await User.find({ email: { $regex: `^${escapeRegExp(norm)}$`, $options: 'i' } }).select('email');

    // Read index information
    const coll = (await User.db.db).collection(User.collection.name);
    const indexes = await coll.indexes();

    res.status(200).json({
      query: { email, norm },
      matches: {
        exact: exact.map(d => d.email),
        normExact: normExact.map(d => d.email),
        insensitive: insensitive.map(d => d.email),
      },
      indexes
    });
  } catch (e) {
    console.error('check-email error', e);
    res.status(500).json({ message: 'error', error: e?.message });
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
