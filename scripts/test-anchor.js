#!/usr/bin/env node
// Test anchoring helper (dry-run by default).
// Usage (dry-run): node scripts/test-anchor.js
// To actually send a tx (be careful):
// DRY_RUN=false CHAIN_RPC_URL=... CHAIN_PRIVATE_KEY=0x... node scripts/test-anchor.js

const crypto = require('crypto');

function makePayload(txDoc) {
  return JSON.stringify({
    txId: txDoc._id,
    provider: txDoc.provider,
    receiver: txDoc.receiver,
    credits: txDoc.escrowAmount || txDoc.credits,
    duration: txDoc.duration,
    timestamp: new Date().toISOString()
  });
}

function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function main() {
  const dry = process.env.DRY_RUN !== 'false';

  const sample = {
    _id: process.env.TX_ID || 'sample-tx-' + Date.now(),
    provider: process.env.PROVIDER || 'provider-1',
    receiver: process.env.RECEIVER || 'receiver-1',
    escrowAmount: process.env.ESCROW || 5,
    duration: process.env.DURATION || '1h'
  };

  const payload = makePayload(sample);
  const proof = sha256hex(payload);
  const data = '0x' + proof;

  console.log('Sample payload:', payload);
  console.log('Proof (sha256):', proof);
  console.log('Tx data (0x...):', data);

  if (dry) {
    console.log('\nDRY RUN (no transaction sent). To send a real tx, set DRY_RUN=false and ensure CHAIN_RPC_URL and CHAIN_PRIVATE_KEY are set.');
    return;
  }

  // live send
  const rpc = process.env.CHAIN_RPC_URL;
  const pk = process.env.CHAIN_PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error('CHAIN_RPC_URL and CHAIN_PRIVATE_KEY are required to send a transaction.');
    process.exit(2);
  }

  try {
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);

    const tx = { to: wallet.address, value: 0, data };
    console.log('Sending tx to', wallet.address);
    const resp = await wallet.sendTransaction(tx);
    console.log('Sent tx hash:', resp.hash);
    await resp.wait(1);
    console.log('Confirmed tx:', resp.hash);
  } catch (err) {
    console.error('Error sending tx:', err);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
