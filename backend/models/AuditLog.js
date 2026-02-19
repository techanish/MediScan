const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  action: String,
  user: { type: String },
  batchID: String,
  timestamp: { type: Date, default: Date.now },
  details: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
