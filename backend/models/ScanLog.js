const mongoose = require("mongoose");

const ScanLogSchema = new mongoose.Schema({
  batchID: String,
  result: String,
  scanner: String,
  time: { type: Date, default: Date.now },
  location: { type: String },
  deviceId: { type: String },
  user: { type: String },
  anomaly: { type: Boolean, default: false }
});

module.exports = mongoose.model("ScanLog", ScanLogSchema);
