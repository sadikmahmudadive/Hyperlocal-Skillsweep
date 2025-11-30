import Stripe from 'stripe';
import paymentConfig from '../../../config/payments';

let stripeInstance = null;

export const stripeCurrency = (process.env.STRIPE_CURRENCY || paymentConfig.checkoutCurrency || paymentConfig.currency || 'usd').toLowerCase();
const zeroDecimalCurrencies = new Set(['jpy', 'krw']);

function assertStripeKey() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY – set it in your environment to enable Stripe payments.');
  }
}

export function getStripeClient() {
  assertStripeKey();
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: false,
    });
  }
  return stripeInstance;
}

export function getAppBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (url) return url.replace(/\/$/, '');
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

export function toMinorUnits(amount) {
  const numeric = typeof amount === 'number' ? amount : Number(amount || 0);
  const factor = zeroDecimalCurrencies.has(stripeCurrency) ? 1 : 100;
  return Math.max(1, Math.round(numeric * factor));
}

export function describeCredits(credits) {
  const qty = Number(credits) || 0;
  return `${qty} SkillSwap credits`;
}
