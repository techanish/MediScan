// Utility to interact with the blockchain microservice
const axios = require('axios');
const crypto = require('crypto');

const BLOCKCHAIN_API = (process.env.BLOCKCHAIN_API_URL || 'http://localhost:5001').replace(/\/$/, '');
const BLOCKCHAIN_TIMEOUT_MS = Number(process.env.BLOCKCHAIN_TIMEOUT_MS || 15000);

const blockchainClient = axios.create({
  baseURL: BLOCKCHAIN_API,
  timeout: Number.isFinite(BLOCKCHAIN_TIMEOUT_MS) ? BLOCKCHAIN_TIMEOUT_MS : 15000,
});

// Embedded fallback chain for environments where the Python microservice is not running.
const embeddedChain = [
  {
    index: 0,
    timestamp: Date.now(),
    data: 'Genesis Block',
    previous_hash: '0',
    hash: '0',
  },
];

function computeBlockHash(block) {
  const payload = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    data: block.data,
    previous_hash: block.previous_hash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function addEmbeddedBlock(data) {
  const previous = embeddedChain[embeddedChain.length - 1];
  const next = {
    index: embeddedChain.length,
    timestamp: Date.now(),
    data,
    previous_hash: previous.hash,
  };
  next.hash = computeBlockHash(next);
  embeddedChain.push(next);
  return next;
}

function getEmbeddedChain() {
  return embeddedChain;
}

function shouldFallback(err) {
  const code = err?.code;
  const status = err?.response?.status;
  return [
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNRESET',
    'ETIMEDOUT',
  ].includes(code) || status >= 500;
}

async function addBlock(data) {
  try {
    const res = await blockchainClient.post('/add_block', { data });
    return res.data;
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(`⚠️ Blockchain microservice unavailable at ${BLOCKCHAIN_API}. Using embedded blockchain fallback.`);
      return addEmbeddedBlock(data);
    }
    throw err;
  }
}

async function getChain() {
  try {
    const res = await blockchainClient.get('/chain');
    return res.data;
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(`⚠️ Blockchain microservice unavailable at ${BLOCKCHAIN_API}. Returning embedded blockchain fallback.`);
      return getEmbeddedChain();
    }
    throw err;
  }
}

module.exports = { addBlock, getChain };
