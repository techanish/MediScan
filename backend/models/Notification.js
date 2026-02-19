const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Clerk user ID or email
  type: { 
    type: String, 
    required: true,
    enum: ['EXPIRY_ALERT', 'LOW_STOCK', 'TRANSFER_RECEIVED', 'MEDICINE_BLOCKED', 'SALE_COMPLETED', 'SYSTEM']
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  batchID: { type: String, default: "" }, // Related medicine batch
  read: { type: Boolean, default: false },
  priority: { 
    type: String, 
    default: "normal",
    enum: ['low', 'normal', 'high', 'urgent']
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // Additional data
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days
});

// Index for efficient querying
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

module.exports = mongoose.model("Notification", NotificationSchema);
