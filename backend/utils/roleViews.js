// backend/utils/roleViews.js
// Example: restrict data fields by role
function filterMedicineByRole(medicine, role) {
  if (role === 'ADMIN') return medicine;
  if (role === 'PHARMACY') {
    const { integrityHash, audit, ...rest } = medicine;
    return rest;
  }
  // For CUSTOMER, hide owner history and trustScore
  const { ownerHistory, trustScore, integrityHash, audit, ...rest } = medicine;
  return rest;
}

module.exports = { filterMedicineByRole };
