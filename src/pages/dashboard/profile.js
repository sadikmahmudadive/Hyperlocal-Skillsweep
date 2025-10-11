import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import InteractiveCard from '../../components/ui/InteractiveCard';
import GradientPill from '../../components/ui/GradientPill';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

export default function EditProfile() {
  const { user, updateUserProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    address: '',
    maxDistance: 10
  });
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  const router = useRouter();
  useRequireAuth();
  const { addToast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        address: user.address || '',
        maxDistance: user.preferences?.maxDistance || 10
      });
      setAvatarPreview(user.avatar?.url || '');
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateFile = (file) => {
    if (!file) return 'No file selected';
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, or WebP)';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'Image size should be less than 5MB';
    }
    return null;
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setAvatarError(error);
      setMessage(error);
      return;
    }
    setAvatarError('');
    setAvatar(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setAvatarError(error);
      setMessage(error);
      return;
    }
    setAvatarError('');
    setAvatar(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Resize large images to max 800x800 before encoding to reduce upload time
  const convertToBase64Optimized = (file, maxSize = 800, quality = 0.9) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const longer = Math.max(width, height);
          if (longer > maxSize) {
            const scale = maxSize / longer;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // Prefer original type, fallback to jpeg
          const mime = file.type || 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime.includes('png') ? 'image/png' : 'image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setUploadProgress(0);

    try {
      let avatarUrl = user.avatar?.url;
      let avatarPublicId = user.avatar?.public_id;

      // Upload avatar if a new one was selected
      if (avatar) {
        try {
          setUploadProgress(10);
          console.log('Converting image to base64...');
          
          // Convert image to base64 for Cloudinary
          const imageBase64 = await convertToBase64Optimized(avatar);
          setUploadProgress(30);

          console.log('Starting Cloudinary upload...');
          addToast({ type: 'info', title: 'Uploading avatar', message: 'Optimizing and uploading your image...' });
          const uploadResponse = await fetch('/api/upload/avatar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              image: imageBase64,
              name: formData.name
            })
          });

          setUploadProgress(70);

          // Check if response is OK
          if (!uploadResponse.ok) {
            let errorMessage = 'Failed to upload avatar';
            
            try {
              const errorText = await uploadResponse.text();
              console.error('Upload error response:', errorText);
              
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
              } catch {
                errorMessage = errorText || errorMessage;
              }
            } catch (textError) {
              console.error('Error reading error response:', textError);
            }
            
            throw new Error(errorMessage);
          }

          // Parse successful response
          const uploadData = await uploadResponse.json();
          console.log('Upload successful response:', uploadData);
          
          if (uploadData.success) {
            avatarUrl = uploadData.url;
            avatarPublicId = uploadData.public_id;
            setMessage('Avatar uploaded successfully!');
            addToast({ type: 'success', title: 'Avatar updated' });
          } else {
            throw new Error(uploadData.message || 'Upload failed');
          }
          
        } catch (uploadError) {
          console.error('Avatar upload error:', uploadError);
          // Use fallback avatar
          avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=0ea5e9&color=fff&size=300`;
          setMessage('Profile updated! (Using fallback avatar due to upload issue: ' + uploadError.message + ')');
          addToast({ type: 'warning', title: 'Using fallback avatar', message: uploadError.message });
        }
      }

      setUploadProgress(90);

      // Update profile data
      const updateData = {
        name: formData.name.trim(),
        bio: formData.bio.trim(),
        address: formData.address.trim(),
        preferences: {
          maxDistance: parseInt(formData.maxDistance),
          notifications: user.preferences?.notifications || { email: true, push: true }
        }
      };

      // Only include avatar if we have a new URL
      if (avatarUrl && avatarUrl !== user.avatar?.url) {
        updateData.avatar = { 
          url: avatarUrl,
          public_id: avatarPublicId || `avatar_${user.id}`
        };
      }

      const result = await updateUserProfile(updateData);
      setUploadProgress(100);

      if (result.success) {
        setMessage('Profile updated successfully!' + (avatar ? ' Avatar uploaded.' : ''));
        setAvatar(null);
        addToast({ type: 'success', title: 'Profile saved' });
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        const errMsg = result.error || 'Failed to update profile';
        setMessage(errMsg);
        addToast({ type: 'error', title: 'Profile update failed', message: errMsg });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage('Error updating profile: ' + error.message);
      addToast({ type: 'error', title: 'Profile update failed', message: error.message });
    }
    setLoading(false);
    setUploadProgress(0);
  };

  const removeAvatar = () => {
    setAvatar(null);
    setAvatarPreview(user.avatar?.url || '');
    const fileInput = document.getElementById('avatar');
    if (fileInput) fileInput.value = '';
  };
  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <LoadingSpinner size="large" />
        <p className="text-sm text-slate-500 dark:text-slate-300">Preparing your profile editor…</p>
      </div>
    );
  }

  const messageIsPositive = message.includes('success') || message.includes('uploaded');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Profile"
        title="Polish your SkillSwap presence"
        subtitle="Refresh details, tweak your reach, and make it easy for neighbors to get to know you."
        actions={(
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            Back to dashboard
          </Button>
        )}
      />

      {message && (
        <InteractiveCard className={`border ${messageIsPositive ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200' : 'border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200'}`}>
          <div className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-lg">{messageIsPositive ? '✨' : '⚠️'}</span>
            <div>
              <h3 className="font-semibold">{messageIsPositive ? 'Profile updated' : 'Attention needed'}</h3>
              <p className="mt-1 text-sm leading-relaxed">{message}</p>
            </div>
          </div>
        </InteractiveCard>
      )}

      {uploadProgress > 0 && uploadProgress < 100 && (
        <InteractiveCard className="border border-sky-300/60 bg-sky-500/10">
          <div className="flex items-center gap-4">
            <LoadingSpinner size="small" />
            <div className="flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Uploading avatar…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/50 dark:bg-slate-900/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300/80">We&apos;re optimizing your image so it looks crisp everywhere.</p>
            </div>
          </div>
        </InteractiveCard>
      )}

      <InteractiveCard as="form" onSubmit={handleSubmit} className="space-y-10">
        <section className="space-y-4">
          <GradientPill>Profile photo</GradientPill>
          <p className="text-sm text-slate-500 dark:text-slate-300">Drop in a bright, welcoming photo—neighbors are more likely to connect when they see a friendly face.</p>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`group relative flex flex-col gap-6 rounded-3xl border-2 border-dashed border-white/60 bg-white/40 p-6 transition-all duration-300 dark:border-slate-800/60 dark:bg-slate-900/40 sm:flex-row sm:items-center ${isDragging ? 'border-emerald-400 bg-emerald-400/10 dark:border-emerald-500' : ''}`}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              className="relative h-28 w-28 overflow-hidden rounded-3xl ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated dark:ring-emerald-500/40 dark:ring-offset-slate-900"
            >
              <img
                src={avatarPreview || user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0ea5e9&color=fff&size=256&bold=true`}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-xs font-semibold uppercase tracking-[0.3em] text-white transition group-hover:bg-slate-900/50">
                Change
              </div>
            </button>
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  as="label"
                  htmlFor="avatar"
                  variant="secondary"
                  className="cursor-pointer px-6"
                >
                  <input
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                    ref={fileInputRef}
                  />
                  Choose image
                </Button>
                {avatar && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-rose-300/60 text-rose-500 hover:border-rose-400 hover:text-rose-600 dark:border-rose-500/30 dark:text-rose-200"
                    onClick={removeAvatar}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, JPEG, or WebP up to 5MB.</p>
              {avatarError && <p className="text-xs text-rose-500 dark:text-rose-300">{avatarError}</p>}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Your name"
              required
              maxLength={50}
            />
            <div className="text-xs text-slate-400">{formData.name?.length || 0}/50</div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={4}
              className="input-field resize-none"
              placeholder="Share your story, specialties, and what you love to trade (max 500 characters)."
              maxLength={500}
            />
            <div className="text-xs text-slate-400">{formData.bio?.length || 0}/500</div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label htmlFor="address" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleInputChange}
              className="input-field"
              placeholder="Neighborhood, city, or meetup area"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="maxDistance" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Max distance (km)
            </label>
            <input
              id="maxDistance"
              name="maxDistance"
              type="number"
              min={1}
              max={100}
              value={formData.maxDistance}
              onChange={handleInputChange}
              className="input-field"
              required
            />
          </div>
        </section>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/dashboard')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            Save changes
          </Button>
        </div>
      </InteractiveCard>
    </div>
  );
}