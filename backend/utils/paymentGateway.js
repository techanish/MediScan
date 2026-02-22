// paymentGateway.js
// Utility for payment processing (mock for now)

module.exports = {
  processPayment: async ({ amount, userId, medicineId }) => {
    // Simulate payment processing
    // Add tax/discount logic if needed
    return {
      success: true,
      transactionId: 'TXN-' + Date.now(),
      status: 'paid'
    };
  }
};