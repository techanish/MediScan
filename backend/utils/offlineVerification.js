// backend/utils/offlineVerification.js
// Helper for offline verification support
const Medicine = require('../models/Medicine');
const crypto = require('crypto');

// Generate a minimal offline-verifiable payload for a batch
function getOfflinePayload(medicine) {
  return {
    batchID: medicine.batchID,
    name: medicine.name,
    expDate: medicine.expDate,
    status: medicine.status,
    trustScore: medicine.trustScore,
    integrityHash: medicine.integrityHash
  };
}

// Verify payload integrity offline
function verifyOfflinePayload(payload) {
  const data = `${payload.batchID}|${payload.name}|${payload.expDate}|${payload.status}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash === payload.integrityHash;
}

module.exports = { getOfflinePayload, verifyOfflinePayload };
