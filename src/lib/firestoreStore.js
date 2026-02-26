import { getFirestoreDb } from './firebaseAdmin';

const COLLECTIONS = {
  users: 'users',
  transactions: 'transactions',
  conversations: 'conversations',
  reviews: 'reviews',
  topupIntents: 'topupIntents'
};

const nowIso = () => new Date().toISOString();

const toDoc = (snap) => ({ id: snap.id, _id: snap.id, ...snap.data() });

const toDateMs = (value) => {
  if (!value) return 0;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export async function geocodeAddress(address) {
  const query = String(address || '').trim();
  if (!query) return null;
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const center = data?.features?.[0]?.center;
    if (!Array.isArray(center) || center.length < 2) return null;
    const [lng, lat] = center.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
  } catch (_) {
    return null;
  }
}

export async function getUserById(id) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.users).doc(String(id)).get();
  if (!snap.exists) return null;
  return toDoc(snap);
}

export async function getUserByEmail(email) {
  const db = getFirestoreDb();
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return null;
  const snap = await db.collection(COLLECTIONS.users).where('email', '==', norm).limit(1).get();
  if (snap.empty) return null;
  return toDoc(snap.docs[0]);
}

export async function createUser(data) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.users).doc();
  const doc = {
    ...data,
    email: String(data.email || '').trim().toLowerCase(),
    createdAt: data.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, _id: ref.id, ...doc };
}

export async function listAllUsers(limit = 500) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.users).limit(limit).get();
  return snap.docs.map(toDoc);
}

export async function patchUser(id, patch) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.users).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) return null;
  await ref.set({ ...patch, updatedAt: nowIso() }, { merge: true });
  const updated = await ref.get();
  return toDoc(updated);
}

export async function searchUsers({ query, category, distance = 10, lat, lng }) {
  const all = await listAllUsers(1000);
  const queryNorm = String(query || '').trim().toLowerCase();
  const categoryNorm = String(category || '').trim().toLowerCase();
  const hasGeo = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const maxKm = Number(distance) > 0 ? Number(distance) : 10;

  const enriched = hasGeo
    ? await Promise.all(
        all.map(async (user) => {
          const coords = user.location?.coordinates;
          const hasValidCoords =
            Array.isArray(coords) &&
            coords.length >= 2 &&
            Number.isFinite(Number(coords[0])) &&
            Number.isFinite(Number(coords[1]));

          if (hasValidCoords) return user;

          const address = String(user.location?.address || user.address || '').trim();
          if (!address) return user;

          const geocoded = await geocodeAddress(address);
          if (!geocoded) return user;

          const nextLocation = {
            type: 'Point',
            coordinates: geocoded,
            address,
          };

          patchUser(user.id || user._id, { location: nextLocation }).catch(() => {});
          return { ...user, location: nextLocation };
        })
      )
    : all;

  return enriched
    .filter((user) => user.isAvailable !== false)
    .filter((user) => {
      if (!queryNorm) return true;
      const offered = (user.skillsOffered || []).some((s) => String(s?.name || '').toLowerCase().includes(queryNorm));
      const needed = (user.skillsNeeded || []).some((s) => String(s?.name || '').toLowerCase().includes(queryNorm));
      const name = String(user.name || '').toLowerCase().includes(queryNorm);
      const bio = String(user.bio || '').toLowerCase().includes(queryNorm);
      return offered || needed || name || bio;
    })
    .filter((user) => {
      if (!categoryNorm || categoryNorm === 'all') return true;
      return (user.skillsOffered || []).some((s) => String(s?.category || '').toLowerCase() === categoryNorm);
    })
    .filter((user) => {
      if (!hasGeo) return true;
      const coords = user.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return false;
      const [uLng, uLat] = coords.map(Number);
      if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) return false;
      const km = haversineKm(latNum, lngNum, uLat, uLng);
      return km <= maxKm;
    })
    .slice(0, 50);
}

export async function getUsersByIds(ids = []) {
  const unique = Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean)));
  const users = await Promise.all(unique.map((id) => getUserById(id)));
  return users.filter(Boolean);
}

export async function listTransactionsForUser(userId, status) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.transactions).limit(500).get();
  const all = snap.docs.map(toDoc);
  return all
    .filter((tx) => String(tx.provider) === String(userId) || String(tx.receiver) === String(userId))
    .filter((tx) => !status || status === 'all' || tx.status === status)
    .sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt))
    .slice(0, 50);
}

export async function getTransactionById(id) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.transactions).doc(String(id)).get();
  if (!snap.exists) return null;
  return toDoc(snap);
}

export async function createTransaction(data) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.transactions).doc();
  const doc = {
    provider: String(data.provider),
    receiver: String(data.receiver),
    skill: data.skill || {},
    duration: data.duration || '',
    credits: Number(data.credits || 0),
    amount: Number(data.amount || 0),
    discount: Number(data.discount || 0),
    finalAmount: Number(data.finalAmount || 0),
    currency: data.currency || 'usd',
    scheduledDate: data.scheduledDate || null,
    status: data.status || 'pending',
    audit: data.audit || [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, _id: ref.id, ...doc };
}

export async function patchTransaction(id, patch) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.transactions).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ ...patch, updatedAt: nowIso() }, { merge: true });
  const updated = await ref.get();
  return toDoc(updated);
}

export async function listConversationsForUser(userId) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.conversations).limit(500).get();
  return snap.docs
    .map(toDoc)
    .filter((c) => (c.participants || []).map(String).includes(String(userId)))
    .sort((a, b) => toDateMs(b.updatedAt) - toDateMs(a.updatedAt))
    .slice(0, 50);
}

export async function getConversationById(id) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.conversations).doc(String(id)).get();
  if (!snap.exists) return null;
  return toDoc(snap);
}

export async function findConversationByParticipants(userId, otherParticipantId, skillTopic) {
  const all = await listConversationsForUser(userId);
  return all.find((c) => {
    const parts = (c.participants || []).map(String);
    const both = parts.includes(String(userId)) && parts.includes(String(otherParticipantId));
    if (!both) return false;
    if (!skillTopic || !String(skillTopic).trim()) return true;
    return String(c.skillTopic || '') === String(skillTopic);
  }) || null;
}

export async function createConversation(data) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.conversations).doc();
  const doc = {
    participants: (data.participants || []).map(String),
    skillTopic: data.skillTopic || '',
    messages: Array.isArray(data.messages) ? data.messages : [],
    lastMessage: data.lastMessage || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, _id: ref.id, ...doc };
}

export async function addConversationMessage(conversationId, message) {
  const conv = await getConversationById(conversationId);
  if (!conv) return null;
  const nextMessage = {
    _id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sender: String(message.sender),
    content: String(message.content || ''),
    read: !!message.read,
    type: message.type || 'text',
    createdAt: nowIso(),
  };
  const nextMessages = [...(conv.messages || []), nextMessage];
  return patchConversation(conversationId, {
    messages: nextMessages,
    lastMessage: nextMessage,
  });
}

export async function patchConversation(id, patch) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.conversations).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ ...patch, updatedAt: nowIso() }, { merge: true });
  const updated = await ref.get();
  return toDoc(updated);
}

export async function listReviews({ targetUserId, reviewerId, page = 1, limit = 10 }) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.reviews).limit(1000).get();
  const all = snap.docs.map(toDoc);
  const filtered = all
    .filter((r) => (targetUserId ? String(r.targetUser) === String(targetUserId) : true))
    .filter((r) => (reviewerId ? String(r.reviewer) === String(reviewerId) : true))
    .sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt));

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(1, Math.min(Number(limit) || 10, 50));
  const start = (pageNum - 1) * limitNum;
  return {
    reviews: filtered.slice(start, start + limitNum),
    total: filtered.length,
    page: pageNum,
    pageSize: limitNum,
    totalPages: Math.max(1, Math.ceil(filtered.length / limitNum))
  };
}

export async function findReviewById(id) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.reviews).doc(String(id)).get();
  if (!snap.exists) return null;
  return toDoc(snap);
}

export async function findReviewByUnique({ reviewer, targetUser, transaction }) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.reviews)
    .where('reviewer', '==', String(reviewer))
    .where('targetUser', '==', String(targetUser))
    .where('transaction', '==', String(transaction))
    .limit(1)
    .get();
  if (snap.empty) return null;
  return toDoc(snap.docs[0]);
}

export async function createReview(data) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.reviews).doc();
  const doc = {
    reviewer: String(data.reviewer),
    targetUser: String(data.targetUser),
    rating: Number(data.rating),
    comment: String(data.comment || ''),
    transaction: String(data.transaction),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, _id: ref.id, ...doc };
}

export async function patchReview(id, patch) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.reviews).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ ...patch, updatedAt: nowIso() }, { merge: true });
  const updated = await ref.get();
  return toDoc(updated);
}

export async function deleteReview(id) {
  const db = getFirestoreDb();
  await db.collection(COLLECTIONS.reviews).doc(String(id)).delete();
}

export async function reviewStats(targetUserId) {
  const { reviews } = await listReviews({ targetUserId, page: 1, limit: 1000 });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const r of reviews) {
    const rating = Number(r.rating || 0);
    if (distribution[rating] !== undefined) {
      distribution[rating] += 1;
      total += 1;
      sum += rating;
    }
  }
  const average = total ? Math.round((sum / total) * 10) / 10 : 0;
  return { average, count: total, distribution, reviews };
}

export async function listReviewsForTransactions(reviewerId, transactionIds = []) {
  const ids = new Set((transactionIds || []).map(String));
  const { reviews } = await listReviews({ reviewerId, page: 1, limit: 1000 });
  return reviews.filter((r) => ids.has(String(r.transaction)));
}

export async function findTopUpIntentById(id) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.topupIntents).doc(String(id)).get();
  if (!snap.exists) return null;
  return toDoc(snap);
}

export async function findTopUpIntentByIdempotencyKey(key) {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.topupIntents)
    .where('idempotencyKey', '==', String(key))
    .where('status', 'in', ['initiated', 'pending'])
    .limit(1)
    .get();
  if (snap.empty) return null;
  return toDoc(snap.docs[0]);
}

export async function createTopUpIntent(data) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.topupIntents).doc();
  const doc = {
    user: String(data.user),
    provider: data.provider,
    credits: Number(data.credits || 0),
    amountFiat: Number(data.amountFiat || 0),
    currency: data.currency || 'USD',
    idempotencyKey: data.idempotencyKey,
    status: data.status || 'initiated',
    metadata: data.metadata || {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(doc);
  return { id: ref.id, _id: ref.id, ...doc };
}

export async function patchTopUpIntent(id, patch) {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.topupIntents).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set({ ...patch, updatedAt: nowIso() }, { merge: true });
  const updated = await ref.get();
  return toDoc(updated);
}
