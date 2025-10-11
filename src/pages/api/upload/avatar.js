import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
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
    const { image, name } = req.body;

    console.log('Avatar upload request received for user:', userId);

    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    // Check if image is base64 string (with or without data URL prefix)
    let base64Data = image;
    
    // If it has data URL prefix, extract the base64 part
    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        base64Data = matches[2];
      }
    }

    if (!base64Data) {
      return res.status(400).json({ message: 'Invalid image format' });
    }

    console.log('Uploading to Cloudinary...');

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:image/jpeg;base64,${base64Data}`,
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

    console.log('Cloudinary upload successful:', uploadResult.secure_url);

    // Update user in database
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        avatar: {
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id
        }
      },
      { new: true }
    ).select('-password');

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

export default requireAuth(handler);