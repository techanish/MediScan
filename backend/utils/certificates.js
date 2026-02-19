// backend/utils/certificates.js
const crypto = require('crypto');

function generateCertificate(batchID, owner, issuedAt = new Date()) {
  // Simple digital certificate (in production, use PKI)
  const cert = {
    batchID,
    owner,
    issuedAt,
    certId: crypto.randomUUID(),
    signature: null
  };
  cert.signature = crypto.createHash('sha256').update(batchID + owner + issuedAt).digest('hex');
  return cert;
}

module.exports = { generateCertificate };
