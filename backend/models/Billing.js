// Billing.js
// Model for billing and invoice records

const mongoose = require('mongoose');

const BillingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  amount: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  invoiceNumber: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false }
});

module.exports = mongoose.model('Billing', BillingSchema);