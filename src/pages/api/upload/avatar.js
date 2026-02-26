import cloudinary from '../../../lib/cloudinary';
import { requireAuthRateLimited } from '../../../middleware/auth';
import { applyApiSecurityHeaders, parseBase64Image } from '../../../lib/security';
import { RATE_LIMIT_PROFILES } from '../../../lib/rateLimitProfiles';
import { getUserById, patchUser } from '../../../lib/firestoreStore';

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
    const userId = req.userId;
    const { image, name } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const { mimeType, base64Data } = parseBase64Image(image, { maxBytes: 5 * 1024 * 1024 });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:${mimeType};base64,${base64Data}`,
        {
          folder: 'skillswap/avatars',
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto' },
            { format: 'jpg' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    const existingUser = await getUserById(userId);
    if (!existingUser) {
      await cloudinary.uploader.destroy(uploadResult.public_id);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await patchUser(userId, {
      avatar: {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id
      }
    });

    if (!user) {
      // Rollback: delete the uploaded image if user update fails
      await cloudinary.uploader.destroy(uploadResult.public_id);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      user
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    
    // More specific error handling
    if (error.message.includes('Invalid image')) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid image file. Please upload a valid image (JPEG, PNG, etc.).' 
      });
    }

    if (error.message.includes('Unsupported image format') || error.message.includes('Image is too large')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.http_code === 401) {
      return res.status(500).json({ 
        success: false,
        message: 'Cloudinary authentication failed. Please check your API credentials.' 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Upload failed: ' + (error.message || 'Unknown error occurred')
    });
  }
}

export default requireAuthRateLimited(handler, {
  ...RATE_LIMIT_PROFILES.avatarUploadWrite,
  methods: ['POST'],
  keyPrefix: 'upload:avatar'
});