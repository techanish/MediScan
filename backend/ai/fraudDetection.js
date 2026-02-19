const ScanLog = require('../models/ScanLog');
const Medicine = require('../models/Medicine');
const crypto = require('crypto');

// Helper: Calculate Trust Score
async function calculateTrustScore(batchID) {
  const logs = await ScanLog.find({ batchID }).sort({ time: 1 });
  let score = 100;
  let reasons = [];

  // QR Reuse: Multiple scans from different users/devices in short time
  const uniqueDevices = new Set(logs.map(l => l.deviceId));
  if (uniqueDevices.size > 3) {
    score -= 20;
    reasons.push('Multiple devices scanned QR');
  }

  // Abnormal Scan Frequency
  if (logs.length > 10) {
    score -= 15;
    reasons.push('High scan frequency');
  }

  // Geographic Inconsistencies
  const locations = new Set(logs.map(l => l.location));
  if (locations.size > 2) {
    score -= 15;
    reasons.push('Scans from multiple locations');
  }

  // Post-sold/consumed/expired scanning
  const medicine = await Medicine.findOne({ batchID });
  if (medicine.status !== 'ACTIVE' && logs.some(l => l.time > medicine.updatedAt)) {
    score -= 30;
    reasons.push('Scans after sold/consumed/expired');
  }

  // Expiry
  const now = new Date();
  if (medicine.expDate && new Date(medicine.expDate) < now) {
    score -= 10;
    reasons.push('Medicine expired');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

// Helper: Integrity Hash
function computeIntegrityHash(medicine) {
  const data = `${medicine.batchID}|${medicine.name}|${medicine.expDate}|${medicine.currentOwner}|${medicine.status}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { calculateTrustScore, computeIntegrityHash };
