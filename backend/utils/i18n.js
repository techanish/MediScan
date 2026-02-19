// backend/utils/i18n.js
// Simple i18n utility for multi-language support
const messages = {
  en: {
    verified: "Genuine Medicine Verified",
    suspicious: "Suspicious Medicine Verified",
    fake: "Fake or Tampered QR"
  },
  es: {
    verified: "Medicamento genuino verificado",
    suspicious: "Medicamento sospechoso verificado",
    fake: "QR falso o manipulado"
  }
  // Add more languages as needed
};

function getMessage(key, lang = 'en') {
  return messages[lang]?.[key] || messages['en'][key] || key;
}

module.exports = { getMessage };
