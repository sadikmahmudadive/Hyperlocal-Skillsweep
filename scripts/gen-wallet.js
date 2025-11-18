#!/usr/bin/env node
// Generate a new Ethereum-compatible private key and (if available) address.
// Usage: node scripts/gen-wallet.js
const crypto = require('crypto');

function generatePrivateKey() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

async function main() {
  const pk = generatePrivateKey();
  let address = null;
  try {
    // try to derive address via ethers if installed
    const { Wallet } = require('ethers');
    const w = new Wallet(pk);
    address = w.address;
  } catch (err) {
    // ethers not available or failed; skip address derivation
  }

  console.log('PRIVATE_KEY:', pk);
  if (address) console.log('ADDRESS:', address);
  console.log('\nIMPORTANT: do NOT commit this key. Add it to your .env.local or secrets manager.');
}

main().catch(err => { console.error(err); process.exit(1); });
