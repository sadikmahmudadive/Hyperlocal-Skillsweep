import paymentConfig, { creditsToFiat, fiatToCredits } from '../../config/payments';
import mongoose from 'mongoose';

export function validateTopUp(credits) {
  if (typeof credits !== 'number' || !Number.isFinite(credits)) return 'Invalid credits';
  if (credits < paymentConfig.minTopUpCredits) return `Minimum top-up is ${paymentConfig.minTopUpCredits} credit`; 
  if (credits > paymentConfig.maxTopUpCredits) return `Maximum top-up is ${paymentConfig.maxTopUpCredits} credits`; 
  return null;
}

export function computeFiat(credits) {
  return creditsToFiat(credits);
}

export async function recordLedgerEntry(userDoc, type, amount, note, txRef) {
  const balanceAfter = (userDoc.credits || 0) + (type === 'topup' ? amount : 0);
  userDoc.ledger.push({ type, amount, balanceAfter, txRef, note });
  userDoc.credits = balanceAfter;
  await userDoc.save();
  return balanceAfter;
}

export function supportedProvider(provider) {
  return paymentConfig.providers.includes(provider);
}

export function createIdempotencyKey(userId, credits, provider) {
  return `${userId}:${provider}:${credits}:${new Date().toISOString().slice(0,10)}`;
}

export default {
  paymentConfig,
  validateTopUp,
  computeFiat,
  fiatToCredits,
  creditsToFiat,
  recordLedgerEntry,
  supportedProvider,
  createIdempotencyKey
};
