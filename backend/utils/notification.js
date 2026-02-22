// backend/utils/notification.js
// Simple notification utility using nodemailer (can be replaced with SMS, push, etc.)
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NOTIFY_EMAIL_USER,
    pass: process.env.NOTIFY_EMAIL_PASS
  }
});

async function sendNotification(to, subject, text) {
  const mailOptions = {
    from: process.env.NOTIFY_EMAIL_USER,
    to,
    subject,
    text
  };
  return transporter.sendMail(mailOptions);
}

async function sendNotification(userId, message) {
  // For demo, just log
  console.log(`Notification sent to user ${userId}: ${message}`);
  // Integrate with email/SMS APIs as needed
}

module.exports = {
  sendNotification,
};
