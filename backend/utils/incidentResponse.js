// backend/utils/incidentResponse.js
const Medicine = require('../models/Medicine');
const ScanLog = require('../models/ScanLog');

async function autoBlockSuspiciousBatches(threshold = 5) {
  // Block batches with more than threshold suspicious scans
  const suspicious = await ScanLog.aggregate([
    { $match: { anomaly: true } },
    { $group: { _id: "$batchID", count: { $sum: 1 } } },
    { $match: { count: { $gte: threshold } } }
  ]);
  const batchIDs = suspicious.map(s => s._id);
  await Medicine.updateMany({ batchID: { $in: batchIDs } }, { status: 'BLOCKED' });
  return batchIDs;
}

module.exports = { autoBlockSuspiciousBatches };
