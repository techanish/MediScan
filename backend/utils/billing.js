// billing.js
// Utility for invoice generation, verification, and notifications

const Billing = require('../models/Billing');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const paymentGateway = require('./paymentGateway');
const notification = require('./notification');

const generateInvoiceNumber = () => 'INV-' + Date.now();

async function createInvoice({ userId, medicineId, amount, tax = 0, discount = 0 }) {
  const invoiceNumber = generateInvoiceNumber();
  const billing = new Billing({
    userId,
    medicineId,
    amount,
    tax,
    discount,
    invoiceNumber
  });
  await billing.save();
  return billing;
}

async function processPaymentAndVerify({ billingId }) {
  const billing = await Billing.findById(billingId);
  if (!billing) throw new Error('Invoice not found');
  // Medicine authenticity check
  const medicine = await Medicine.findById(billing.medicineId);
  if (!medicine || !medicine.verified) throw new Error('Medicine not verified');
  // Payment
  const paymentResult = await paymentGateway.processPayment({
    amount: billing.amount + billing.tax - billing.discount,
    userId: billing.userId,
    medicineId: billing.medicineId
  });
  billing.status = paymentResult.status;
  billing.verified = true;
  await billing.save();
  // Notify user
  await notification.sendBillingReceipt(billing.userId, billing);
  return paymentResult;
}

async function getUserBillingHistory(userId) {
  return Billing.find({ userId }).sort({ createdAt: -1 });
}

async function sendBillingReceipt(userId, billing) {
  // Send notification (email/SMS) to user
  // For demo, just log
  console.log(`Receipt sent to user ${userId}: Invoice ${billing.invoiceNumber}`);
  // You can integrate email/SMS APIs here
}

module.exports = {
  createInvoice,
  processPaymentAndVerify,
  getUserBillingHistory,
  sendBillingReceipt
};