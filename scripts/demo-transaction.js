#!/usr/bin/env node
// Demo: create -> confirm -> start -> complete a transaction via API
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/demo-transaction.js
// Optional env:
//   EMAIL_A, PASS_A, NAME_A (receiver)
//   EMAIL_B, PASS_B, NAME_B (provider)

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const A = {
  email: process.env.EMAIL_A || 'demo.receiver@example.com',
  password: process.env.PASS_A || 'Password123!@#',
  name: process.env.NAME_A || 'Demo Receiver',
};

const B = {
  email: process.env.EMAIL_B || 'demo.provider@example.com',
  password: process.env.PASS_B || 'Password123!@#',
  name: process.env.NAME_B || 'Demo Provider',
};

async function registerOrIgnore({ name, email, password }) {
  try {
    await axios.post(`${BASE_URL}/api/auth/register`, { name, email, password });
    console.log('Registered:', email);
  } catch (e) {
    const msg = e?.response?.data?.message || e.message;
    if (e?.response?.status === 400 || e?.response?.status === 409) {
      console.log('Register skipped (likely exists):', email, '-', msg);
    } else {
      console.warn('Register warning:', email, '-', msg);
    }
  }
}

async function login({ email, password }) {
  const { data } = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  return { token: data.token, user: data.user };
}

async function main() {
  console.log('Using BASE_URL =', BASE_URL);
  console.log('Creating demo users (idempotent)...');
  await registerOrIgnore(A);
  await registerOrIgnore(B);

  console.log('Logging in demo users...');
  const a = await login(A);
  const b = await login(B);
  console.log('A user:', a.user?.email, 'B user:', b.user?.email);

  // Create transaction as receiver A
  const skill = { name: 'Tutoring', category: 'education', description: '1 hour session' };
  const payload = { providerId: b.user?.id || b.user?._id, skill, duration: 1, credits: 1 };
  const { data: created } = await axios.post(`${BASE_URL}/api/transactions/create`, payload, {
    headers: { Authorization: `Bearer ${a.token}` }
  });
  const txId = created?.transaction?._id;
  console.log('Created tx:', txId);

  // Confirm as provider B
  const { data: confirmed } = await axios.post(`${BASE_URL}/api/transactions/confirm`, { transactionId: txId }, {
    headers: { Authorization: `Bearer ${b.token}` }
  });
  console.log('Confirmed status:', confirmed?.transaction?.status);

  // Start (either party)
  const { data: started } = await axios.post(`${BASE_URL}/api/transactions/start`, { transactionId: txId }, {
    headers: { Authorization: `Bearer ${a.token}` }
  });
  console.log('Started status:', started?.transaction?.status);

  // Complete (either party)
  const { data: completed } = await axios.post(`${BASE_URL}/api/transactions/complete`, { transactionId: txId }, {
    headers: { Authorization: `Bearer ${b.token}` }
  });
  console.log('Completed status:', completed?.transaction?.status);
  if (completed?.transaction?.onChainTxHash) {
    console.log('Anchored tx hash:', completed.transaction.onChainTxHash);
  } else {
    console.log('Anchoring may be disabled or pending.');
  }

  console.log('Done. Inspect dashboard or DB for results.');
}

main().catch(err => {
  const msg = err?.response?.data || err.message;
  console.error('Demo failed:', msg);
  process.exit(1);
});
