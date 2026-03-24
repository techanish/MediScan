// Utility to interact with the blockchain microservice
const axios = require('axios');
const crypto = require('crypto');

const BLOCKCHAIN_TIMEOUT_MS = Number(process.env.BLOCKCHAIN_TIMEOUT_MS || 15000);
const BLOCKCHAIN_API_URLS = (() => {
  const primary = (process.env.BLOCKCHAIN_API_URL || '').trim();
  const fallback = (process.env.BLOCKCHAIN_API_FALLBACK_URL || '').trim();
  const list = (process.env.BLOCKCHAIN_API_URLS || '').trim();

  const candidates = [
    ...list.split(',').map((url) => url.trim()).filter(Boolean),
    primary,
    fallback,
  ].filter(Boolean);

  if (candidates.length === 0) {
    candidates.push('http://localhost:5001');
  }

  // Ensure localhost stays first when explicitly configured while preserving order.
  const normalized = candidates.map((url) => url.replace(/\/$/, '')).filter(Boolean);
  return [...new Set(normalized)];
})();

const clientCache = new Map();

function getClient(baseURL) {
  if (!clientCache.has(baseURL)) {
    clientCache.set(
      baseURL,
      axios.create({
        baseURL,
        timeout: Number.isFinite(BLOCKCHAIN_TIMEOUT_MS) ? BLOCKCHAIN_TIMEOUT_MS : 15000,
      })
    );
  }
  return clientCache.get(baseURL);
}

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

async function requestWithFailover(executor) {
  let lastRecoverableError = null;

  for (const apiBaseUrl of BLOCKCHAIN_API_URLS) {
    try {
      const client = getClient(apiBaseUrl);
      return await executor(client, apiBaseUrl);
    } catch (err) {
      if (!shouldFallback(err)) {
        throw err;
      }
      lastRecoverableError = err;
      console.warn(`⚠️ Blockchain API unavailable at ${apiBaseUrl}. Trying next endpoint...`);
    }
  }

  throw lastRecoverableError || new Error('No blockchain endpoints configured');
}

async function addBlock(data) {
  try {
    const res = await requestWithFailover((client) => client.post('/add_block', { data }));
    return res.data;
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(
        `⚠️ Blockchain microservice unavailable at all configured endpoints (${BLOCKCHAIN_API_URLS.join(', ')}). Using embedded blockchain fallback.`
      );
      return addEmbeddedBlock(data);
    }
    throw err;
  }
}

async function getChain() {
  try {
    const res = await requestWithFailover((client) => client.get('/chain'));
    return res.data;
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(
        `⚠️ Blockchain microservice unavailable at all configured endpoints (${BLOCKCHAIN_API_URLS.join(', ')}). Returning embedded blockchain fallback.`
      );
      return getEmbeddedChain();
    }
    throw err;
  }
}

module.exports = { addBlock, getChain };
