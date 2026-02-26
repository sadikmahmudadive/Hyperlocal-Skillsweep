import cloudinary from '../../../lib/cloudinary';
import { applyApiSecurityHeaders, createLimiter, enforceRateLimit } from '../../../lib/security';

const limiter = createLimiter({ limit: 10, windowMs: 60_000 });

export default async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(limiter, req, res))) return;

  try {
    // Test Cloudinary configuration by making a simple API call
    const result = await cloudinary.api.ping();
    
    res.status(200).json({
      success: true,
      message: 'Cloudinary is configured correctly',
      cloudinary: result,
      config: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'Missing',
        apiSecret: process.env.CLOUDINARY_API_SECRET ? '***' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'Missing'
      }
    });
  } catch (error) {
    console.error('Cloudinary test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Cloudinary configuration error: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}