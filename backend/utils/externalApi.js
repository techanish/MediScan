// backend/utils/externalApi.js
// Example: check batchID against external registry (mock)
async function checkBatchWithExternalRegistry(batchID) {
  // Simulate external API call
  // In production, use fetch/axios to call real API
  if (batchID.startsWith('FAKE')) return { valid: false, source: 'ExternalRegistry' };
  return { valid: true, source: 'ExternalRegistry' };
}

module.exports = { checkBatchWithExternalRegistry };
