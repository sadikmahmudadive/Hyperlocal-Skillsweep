import { createUser as createUserFs, getUserByEmail, getUserById, patchUser } from './firestoreStore';
import { normalizeAvatar } from './avatar';

export function getDbProvider() {
  return 'firestore';
}

function defaultUserDoc(data = {}) {
  const userWithAvatar = normalizeAvatar(data, { fallbackName: data.name || 'U' });
  return {
    name: data.name || '',
    email: data.email || '',
    password: data.password || '',
    credits: typeof data.credits === 'number' ? data.credits : 2,
    bio: data.bio || '',
    avatar: userWithAvatar.avatar,
    rating: data.rating || { average: 0, count: 0 },
    skillsOffered: Array.isArray(data.skillsOffered) ? data.skillsOffered : [],
    skillsNeeded: Array.isArray(data.skillsNeeded) ? data.skillsNeeded : [],
    location: data.location || { type: 'Point', coordinates: [0, 0], address: '' },
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    savedSearches: Array.isArray(data.savedSearches) ? data.savedSearches : [],
    preferences: data.preferences || { maxDistance: 10, notifications: { email: true, push: true } },
    isAvailable: data.isAvailable !== false,
    isVerified: !!data.isVerified,
    lastActive: data.lastActive || new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function shapePublicUser(doc) {
  const normalized = normalizeAvatar(doc, { fallbackName: doc?.name || 'User' });
  return {
    id: normalized.id,
    _id: normalized.id,
    name: normalized.name,
    email: normalized.email,
    credits: normalized.credits || 0,
    bio: normalized.bio || '',
    address: normalized.location?.address || '',
    avatar: normalized.avatar,
    rating: normalized.rating || { average: 0, count: 0 },
    skillsOffered: normalized.skillsOffered || [],
    skillsNeeded: normalized.skillsNeeded || [],
    lastActive: normalized.lastActive,
    location: normalized.location,
    favorites: normalized.favorites || [],
    savedSearches: (normalized.savedSearches || []).map((entry) => ({
      id: entry.id || entry._id || '',
      name: entry.name,
      filters: entry.filters || {}
    }))
  };
}

async function createUserFirestore(data) {
  return createUserFs(defaultUserDoc(data));
}

async function updateLastActiveFirestore(id) {
  return patchUser(id, { lastActive: new Date().toISOString() });
}

async function updateProfileFirestore(id, safeUpdateData) {
  return patchUser(id, safeUpdateData);
}

function withSkillId(skill = {}) {
  if (skill.id || skill._id) {
    return { ...skill, id: skill.id || skill._id, _id: skill._id || skill.id };
  }
  const generated = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return { ...skill, id: generated, _id: generated };
}

async function addSkillFirestore(id, type, skill) {
  const doc = await getUserById(id);
  if (!doc) return null;
  const updateField = type === 'offered' ? 'skillsOffered' : 'skillsNeeded';
  const current = Array.isArray(doc[updateField]) ? doc[updateField] : [];
  const next = [...current, withSkillId(skill)];
  return patchUser(id, { [updateField]: next });
}

async function removeSkillFirestore(id, type, skillId) {
  const doc = await getUserById(id);
  if (!doc) return null;
  const updateField = type === 'offered' ? 'skillsOffered' : 'skillsNeeded';
  const current = Array.isArray(doc[updateField]) ? doc[updateField] : [];
  const next = current.filter((item) => String(item?._id || item?.id) !== String(skillId));
  return patchUser(id, { [updateField]: next });
}

export async function findUserByEmail(email) {
  return getUserByEmail(email);
}

export async function createUser(data) {
  return createUserFirestore(data);
}

export async function findUserById(id) {
  return getUserById(id);
}

export async function updateUserLastActive(id) {
  return updateLastActiveFirestore(id);
}

export async function updateUserProfileById(id, safeUpdateData) {
  return updateProfileFirestore(id, safeUpdateData);
}

export async function addUserSkill(id, type, skill) {
  return addSkillFirestore(id, type, skill);
}

export async function removeUserSkill(id, type, skillId) {
  return removeSkillFirestore(id, type, skillId);
}

export function toUserResponse(user) {
  if (!user) return null;
  return shapePublicUser(user);
}
