import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY || '';
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

function isConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseApp() {
  if (!isConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseApp());
}

export function isFirebaseAdminConfigured() {
  return isConfigured();
}
