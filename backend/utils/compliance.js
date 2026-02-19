// backend/utils/compliance.js
// Example: check for expired medicines and regulatory violations
const Medicine = require('../models/Medicine');

async function getComplianceIssues() {
  const now = new Date();
  // Expired medicines
  const expired = await Medicine.find({ expDate: { $lt: now } });
  // Blocked medicines
  const blocked = await Medicine.find({ status: 'BLOCKED' });
  return {
    expired: expired.map(m => m.batchID),
    blocked: blocked.map(m => m.batchID)
  };
}

module.exports = { getComplianceIssues };
