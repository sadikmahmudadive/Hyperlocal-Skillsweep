export function buildDefaultAvatarUrl(name = 'User', size = 128) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0ea5e9&color=fff&size=${size}&bold=true`;
}

export function resolveAvatarUrl(user, options = {}) {
  const fallbackName = options.fallbackName ?? user?.name ?? 'User';
  const size = Number.isFinite(options.size) ? options.size : 128;

  if (typeof user?.avatar === 'string' && user.avatar.trim()) return user.avatar.trim();
  if (typeof user?.avatar?.url === 'string' && user.avatar.url.trim()) return user.avatar.url.trim();
  if (typeof user?.photoURL === 'string' && user.photoURL.trim()) return user.photoURL.trim();
  if (typeof user?.photoUrl === 'string' && user.photoUrl.trim()) return user.photoUrl.trim();
  if (typeof user?.image === 'string' && user.image.trim()) return user.image.trim();
  return buildDefaultAvatarUrl(fallbackName, size);
}

export function normalizeAvatar(user, options = {}) {
  if (!user) return user;
  const resolvedUrl = resolveAvatarUrl(user, options);
  const publicId =
    typeof user?.avatar?.public_id === 'string' && user.avatar.public_id.trim()
      ? user.avatar.public_id.trim()
      : `avatar_${user?.id || user?._id || 'user'}`;

  return {
    ...user,
    avatar: {
      ...(typeof user?.avatar === 'object' && user.avatar ? user.avatar : {}),
      url: resolvedUrl,
      public_id: publicId
    }
  };
}
