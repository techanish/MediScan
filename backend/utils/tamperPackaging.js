// backend/utils/tamperPackaging.js
// Placeholder for tamper-evident packaging integration
function verifyTamperEvidence(batchID, packagingCode) {
  // In production, check packagingCode against secure registry
  // Here, simulate: if code starts with 'SAFE', it's valid
  return packagingCode && packagingCode.startsWith('SAFE');
}

module.exports = { verifyTamperEvidence };
