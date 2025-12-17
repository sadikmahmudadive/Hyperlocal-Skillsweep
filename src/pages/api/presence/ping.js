import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { requireAuth } from '../../../middleware/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    await User.findByIdAndUpdate(req.userId, { lastActive: new Date() }, { new: false });
    return res.status(200).json({ ok: true, at: Date.now() });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}

export default requireAuth(handler);
