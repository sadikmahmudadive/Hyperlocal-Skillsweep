import dbConnect from '../../../lib/dbConnect';
import cloudinary from '../../../lib/cloudinary';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { applyApiSecurityHeaders, parseBase64Image } from '../../../lib/security';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const userId = req.userId;
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const { mimeType, base64Data } = parseBase64Image(image, { maxBytes: 5 * 1024 * 1024 });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:${mimeType};base64,${base64Data}`,
        {
          folder: 'skillswap/chat_images',
          resource_type: 'image',
          // No aggressive cropping, just limit max width/height if needed
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' }, // Resize if too big
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    res.status(200).json({
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });

  } catch (error) {
    console.error('Chat upload error:', error);
    const msg = String(error?.message || 'Upload failed');
    if (msg.includes('image')) {
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Upload failed' });
  }
}

export default requireAuthRateLimited(handler, {
  limit: 20,
  windowMs: 60_000,
  methods: ['POST'],
  keyPrefix: 'chat:upload'
});
