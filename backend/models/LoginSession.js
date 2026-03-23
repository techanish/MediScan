const mongoose = require("mongoose");

const LoginSessionSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  email: { type: String, index: true },
  role: { type: String, default: "CUSTOMER" },
  sessionId: { type: String, default: "", index: true },
  tokenId: { type: String, default: "", index: true },
  ipAddress: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  lastPath: { type: String, default: "" },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

LoginSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("LoginSession", LoginSessionSchema);
