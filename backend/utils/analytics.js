// backend/utils/analytics.js
const ScanLog = require('../models/ScanLog');
const Medicine = require('../models/Medicine');

async function getAnalytics() {
  // Total scans
  const totalScans = await ScanLog.countDocuments();
  // Scans by day (last 30 days)
  const scanTrends = await ScanLog.aggregate([
    { $match: { time: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$time" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  // Top scan locations
  const topLocations = await ScanLog.aggregate([
    { $group: { _id: "$location", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);
  // Suspicious scan count
  const suspiciousScans = await ScanLog.countDocuments({ anomaly: true });
  // Average trust score
  const avgTrust = await Medicine.aggregate([
    { $group: { _id: null, avg: { $avg: "$trustScore" } } }
  ]);
  return {
    totalScans,
    scanTrends,
    topLocations,
    suspiciousScans,
    avgTrustScore: avgTrust[0]?.avg || 0
  };
}

module.exports = { getAnalytics };
