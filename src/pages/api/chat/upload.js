import dbConnect from '../../../lib/dbConnect';
import cloudinary from '../../../lib/cloudinary';
import { requireAuth } from '../../../middleware/auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req, res) {
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

    // Check if image is base64 string
    let base64Data = image;
    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        base64Data = matches[2];
      }
    }

    if (!base64Data) {
      return res.status(400).json({ message: 'Invalid image format' });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:image/jpeg;base64,${base64Data}`,
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
    res.status(500).json({ message: 'Upload failed' });
  }
}

export default requireAuth(handler);
