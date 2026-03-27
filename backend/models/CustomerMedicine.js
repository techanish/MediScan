const mongoose = require("mongoose");

const CustomerMedicineSchema = new mongoose.Schema(
  {
    customerEmail: { type: String, required: true, index: true },
    batchID: { type: String, required: true, index: true },
    medicineName: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    addedVia: {
      type: String,
      enum: ["SCAN_QR", "MANUAL", "PURCHASE_SYNC"],
      default: "MANUAL",
    },
    verificationStatus: {
      type: String,
      enum: ["VERIFIED", "UNVERIFIED", "SUSPICIOUS"],
      default: "VERIFIED",
    },
    verifiedAt: { type: Date, default: Date.now },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

CustomerMedicineSchema.index({ customerEmail: 1, batchID: 1 }, { unique: true });

module.exports = mongoose.model("CustomerMedicine", CustomerMedicineSchema);
