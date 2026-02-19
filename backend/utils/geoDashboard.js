// backend/utils/geoDashboard.js
// Placeholder for geolocation dashboard logic
// In production, use a frontend dashboard (React, Mapbox, Google Maps, etc.)
const ScanLog = require('../models/ScanLog');

async function getScanLocations() {
  // Returns array of { batchID, location, time }
  return ScanLog.find({}, { batchID: 1, location: 1, time: 1, _id: 0 }).sort({ time: -1 });
}

module.exports = { getScanLocations };
