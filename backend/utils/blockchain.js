// Utility to interact with the blockchain microservice
const axios = require('axios');
const crypto = require('crypto');
const BlockchainBlock = require('../models/BlockchainBlock');

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

const GENESIS_BLOCK = Object.freeze({
  index: 0,
  data: 'Genesis Block',
  previous_hash: '0',
  hash: '0',
});

function computeBlockHash(block) {
  const payload = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    data: block.data,
    previous_hash: block.previous_hash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function toBlockShape(blockDoc) {
  return {
    index: blockDoc.index,
    timestamp: blockDoc.timestamp,
    data: blockDoc.data,
    previous_hash: blockDoc.previous_hash,
    hash: blockDoc.hash,
  };
}

function normalizeServiceHash(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeServiceIndex(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeServiceTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isServiceGenesisBlock(block) {
  return (
    normalizeServiceIndex(block?.index) === 0 &&
    block?.previous_hash === '0' &&
    block?.data === 'Genesis Block'
  );
}

async function ensureGenesisBlock() {
  const existingGenesis = await BlockchainBlock.findOne({ index: 0 }).lean();
  if (existingGenesis) {
    return existingGenesis;
  }

  return BlockchainBlock.findOneAndUpdate(
    { index: 0 },
    {
      $setOnInsert: {
        ...GENESIS_BLOCK,
        timestamp: Date.now(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

async function appendDbBlock(data, metadata = {}) {
  await ensureGenesisBlock();

  const serviceHash = normalizeServiceHash(metadata.service_hash || metadata.hash || '');
  if (serviceHash) {
    const existing = await BlockchainBlock.findOne({ service_hash: serviceHash }).lean();
    if (existing) {
      return toBlockShape(existing);
    }
  }

  for (let retryCount = 0; retryCount < 3; retryCount += 1) {
    const previous = await BlockchainBlock.findOne().sort({ index: -1 }).lean();
    const previousBlock = previous || (await ensureGenesisBlock());

    const next = {
      index: previousBlock.index + 1,
      timestamp: Date.now(),
      data,
      previous_hash: previousBlock.hash,
    };
    next.hash = computeBlockHash(next);

    if (serviceHash) {
      next.source = metadata.source || 'python-service';
      next.service_hash = serviceHash;
      next.service_index = normalizeServiceIndex(metadata.service_index ?? metadata.index);
      next.service_timestamp = normalizeServiceTimestamp(metadata.service_timestamp ?? metadata.timestamp);
    } else {
      next.source = metadata.source || 'embedded-fallback';
    }

    try {
      const created = await BlockchainBlock.create(next);
      return toBlockShape(created.toObject());
    } catch (err) {
      // Duplicate index/hash can happen during concurrent writes; retry with latest tail.
      if (err?.code === 11000 && serviceHash) {
        const existing = await BlockchainBlock.findOne({ service_hash: serviceHash }).lean();
        if (existing) {
          return toBlockShape(existing);
        }
      }
      if (err?.code === 11000) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to append blockchain block after retries');
}

async function addEmbeddedBlock(data) {
  return appendDbBlock(data, { source: 'embedded-fallback' });
}

async function syncServiceChainToDb(chain) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return;
  }

  for (const block of chain) {
    if (!block || isServiceGenesisBlock(block)) {
      continue;
    }

    await appendDbBlock(block.data, {
      source: 'python-service',
      service_hash: block.hash,
      service_index: block.index,
      service_timestamp: block.timestamp,
    });
  }
}

async function getEmbeddedChain() {
  await ensureGenesisBlock();
  const chain = await BlockchainBlock.find().sort({ index: 1 }).lean();
  return chain.map(toBlockShape);
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
    return await appendDbBlock(data, {
      source: 'python-service',
      service_hash: res?.data?.hash,
      service_index: res?.data?.index,
      service_timestamp: res?.data?.timestamp,
    });
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(
        `⚠️ Blockchain microservice unavailable at all configured endpoints (${BLOCKCHAIN_API_URLS.join(', ')}). Using embedded blockchain fallback.`
      );
      return await addEmbeddedBlock(data);
    }
    throw err;
  }
}

async function getChain() {
  try {
    const res = await requestWithFailover((client) => client.get('/chain'));
    await syncServiceChainToDb(res.data);
    return await getEmbeddedChain();
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(
        `⚠️ Blockchain microservice unavailable at all configured endpoints (${BLOCKCHAIN_API_URLS.join(', ')}). Returning embedded blockchain fallback.`
      );
      return await getEmbeddedChain();
    }
    throw err;
  }
}

module.exports = { addBlock, getChain };
