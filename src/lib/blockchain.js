import { ethers } from 'ethers';
import crypto from 'crypto';

// Anchors a compact proof of the transaction on-chain by sending a tx with data payload.
// Controlled via environment variables: ENABLE_CHAIN, CHAIN_RPC_URL, CHAIN_PRIVATE_KEY, CHAIN_NAME

export async function anchorTransactionProof(txDoc) {
  if (!process.env.ENABLE_CHAIN || process.env.ENABLE_CHAIN !== 'true') {
    return { ok: false, reason: 'chain disabled' };
  }
  const rpc = process.env.CHAIN_RPC_URL;
  const pk = process.env.CHAIN_PRIVATE_KEY;
  const chainName = process.env.CHAIN_NAME || 'unknown';
  if (!rpc || !pk) throw new Error('CHAIN_RPC_URL and CHAIN_PRIVATE_KEY must be set to anchor');

  // Create a compact proof (sha256 of salient fields)
  const payload = JSON.stringify({
    txId: String(txDoc._id || txDoc.id),
    provider: txDoc.provider?.toString(),
    receiver: txDoc.receiver?.toString(),
    credits: txDoc.escrowAmount || txDoc.credits,
    duration: txDoc.duration,
    timestamp: new Date().toISOString()
  });

  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  // data for on-chain: 0x + hash
  const data = '0x' + hash;

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);

  // Build a minimal transaction sending 0 value to self with data payload
  const tx = {
    to: wallet.address,
    value: 0,
    data
  };

  // estimate gas optionally
  try {
    const resp = await wallet.sendTransaction(tx);
    // wait for 1 confirmation (optional)
    await resp.wait(1);

    return { ok: true, hash: resp.hash, proof: hash };
  } catch (err) {
    console.error('Blockchain anchor error:', err);
    return { ok: false, reason: err.message };
  }
}
