// Central payment configuration
// CREDIT_RATE_BDT: BDT per single platform credit.

const creditRate = parseFloat(process.env.CREDIT_RATE_BDT || '50');

export const paymentConfig = {
  currency: 'BDT',
  creditRate, // 1 credit = creditRate BDT
  minTopUpCredits: 1,
  maxTopUpCredits: 1000,
  providers: ['bkash', 'nagad', 'bank'],
  sandbox: process.env.PAYMENTS_SANDBOX === 'true'
};

export function creditsToFiat(credits) {
  return Math.round(credits * creditRate * 100) / 100; // 2 decimal
}

export function fiatToCredits(amountFiat) {
  return Math.floor(amountFiat / creditRate);
}

export default paymentConfig;
