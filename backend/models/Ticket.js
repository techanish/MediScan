const mongoose = require("mongoose");

const TicketCommentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorEmail: { type: String, required: true },
    authorName: { type: String, default: "User" },
    authorRole: { type: String, default: "CUSTOMER" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: true, timestamps: true }
);

const TicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: {
      type: String,
      enum: ["GENERAL", "TECHNICAL", "BILLING", "TRANSFER", "VERIFICATION", "OTHER"],
      default: "GENERAL",
    },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], default: "OPEN" },
    createdBy: {
      userId: { type: String, required: true },
      email: { type: String, required: true },
      name: { type: String, default: "User" },
      role: { type: String, default: "CUSTOMER" },
      companyName: { type: String, default: "" },
    },
    assignedTo: {
      userId: { type: String, default: "" },
      email: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    lastUpdatedAt: { type: Date, default: Date.now },
    comments: { type: [TicketCommentSchema], default: [] },
  },
  { timestamps: true }
);

TicketSchema.index({ "createdBy.userId": 1, createdAt: -1 });
TicketSchema.index({ status: 1, createdAt: -1 });
TicketSchema.index({ category: 1, priority: 1 });

module.exports = mongoose.model("Ticket", TicketSchema);
