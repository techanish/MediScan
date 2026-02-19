const mongoose = require("mongoose");

const MedicineSchema = new mongoose.Schema({
  batchID: { type: String, unique: true, required: true },
  name: String,
  manufacturer: String,
  mfgDate: String,
  expDate: String,

  // ✅ Enhanced fields
  category: { type: String, default: "General" }, // e.g., Antibiotic, Painkiller, Vaccine
  description: { type: String, default: "" },
  dosage: { type: String, default: "" }, // e.g., "500mg", "10ml"
  composition: { type: String, default: "" }, // Active ingredients
  price: { type: Number, default: 0 }, // Price per unit
  location: { type: String, default: "" }, // Warehouse/shelf location
  imageUrl: { type: String, default: "" }, // Image URL or base64

  // ✅ Units stock per batch
  totalUnits: { type: Number, required: true },
  remainingUnits: { type: Number, required: true },
  reorderPoint: { type: Number, default: 0 }, // Alert when stock reaches this level

  currentOwner: String,

  // ACTIVE / BLOCKED / SOLD_OUT / RECALLED
  status: { type: String, default: "ACTIVE" },
  blockReason: { type: String, default: "" }, // Reason for blocking/recall

  ownerHistory: [
    {
      owner: String,
      role: String,
      action: String, // REGISTERED / TRANSFERRED / PURCHASED / BLOCKED / RECALLED
      unitsPurchased: { type: Number, default: 0 },
      from: String, // Who transferred/sold this (for tracking outgoing transfers/sales)
      time: { type: Date, default: Date.now },
      notes: { type: String, default: "" } // Additional notes for the action
    }
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
MedicineSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Medicine", MedicineSchema);
