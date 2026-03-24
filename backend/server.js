require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { clerkClient } = require("@clerk/clerk-sdk-node");

const Medicine = require("./models/Medicine");
const ScanLog = require("./models/ScanLog");
const Notification = require("./models/Notification");
const Ticket = require("./models/Ticket");
const { clerkAuth, authorizeRoles } = require("./middleware/clerkAuth");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { calculateTrustScore, computeIntegrityHash } = require("./ai/fraudDetection");
const AuditLog = require("./models/AuditLog");
const LoginSession = require("./models/LoginSession");
const { sendNotification } = require("./utils/notification");
const { filterMedicineByRole } = require("./utils/roleViews");

// Blockchain integration
const blockchain = require("./utils/blockchain");

// Constants
const DEFAULT_CUSTOMER_EMAIL = "CUSTOMER";

const app = express();
const realtimeClients = new Map();

// CORS configuration - allow multiple origins
const frontendEnvOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_APP_URL,
  process.env.VERCEL_FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",") : []),
]
  .map((value) => (value || "").trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://10.9.5.204:5173",
  ...frontendEnvOrigins,
];

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (e.g. curl, server-to-server checks)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin);
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

    if (isAllowed || (process.env.NODE_ENV !== "production" && isLocalhost)) {
      return callback(null, true);
    }

    console.warn(`⚠️  CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "8mb" }));
// NoSQL injection protection
app.use(mongoSanitize());

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use("/api/", apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1); // Exit if database connection fails
  });

// Debug endpoint to check medicines by owner (no auth needed for testing)
app.get("/debug/medicines/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const medicines = await Medicine.find({ 
      currentOwner: new RegExp(`^${email}$`, 'i') 
    });
    res.json({ 
      email, 
      count: medicines.length, 
      medicines: medicines.map(m => ({
        batchID: m.batchID,
        name: m.name,
        currentOwner: m.currentOwner,
        status: m.status
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "MediScan API is running",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// ✅ QR Signature - Creates a signed QR code to prevent tampering
function signBatch(batchID) {
  return crypto
    .createHmac("sha256", process.env.QR_SECRET)
    .update(batchID)
    .digest("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "UNKNOWN";
}

function parseBlockchainTimestamp(rawTimestamp, fallbackDate) {
  const parsed = Number(rawTimestamp);
  if (!Number.isFinite(parsed)) return fallbackDate;
  // Python service currently returns unix seconds, but keep this resilient if it changes.
  return new Date(parsed < 1e12 ? parsed * 1000 : parsed);
}

function publishRealtimeUpdate(eventType, payload = {}) {
  const body = JSON.stringify({
    eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  for (const [, client] of realtimeClients) {
    try {
      client.res.write(`event: app-update\n`);
      client.res.write(`data: ${body}\n\n`);
    } catch (err) {
      realtimeClients.delete(client.id);
    }
  }
}

const TICKET_ATTACHMENT_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const TICKET_ATTACHMENT_MAX_COUNT = 4;
const TICKET_ATTACHMENT_MAX_SIZE = 2 * 1024 * 1024;

function normalizeTicketAttachments(rawAttachments) {
  if (!rawAttachments) return [];
  if (!Array.isArray(rawAttachments)) {
    throw new Error("Attachments must be an array");
  }
  if (rawAttachments.length > TICKET_ATTACHMENT_MAX_COUNT) {
    throw new Error(`Maximum ${TICKET_ATTACHMENT_MAX_COUNT} images are allowed`);
  }

  return rawAttachments.map((attachment, index) => {
    if (!attachment || typeof attachment !== "object") {
      throw new Error(`Attachment ${index + 1} is invalid`);
    }

    const name = typeof attachment.name === "string" ? attachment.name.trim() : "";
    const mimeType = typeof attachment.mimeType === "string" ? attachment.mimeType.trim().toLowerCase() : "";
    const size = Number(attachment.size);
    const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl.trim() : "";

    if (!name) {
      throw new Error(`Attachment ${index + 1} name is required`);
    }
    if (!TICKET_ATTACHMENT_ALLOWED_TYPES.has(mimeType)) {
      throw new Error(`Attachment ${index + 1} type is not supported`);
    }
    if (!Number.isFinite(size) || size <= 0 || size > TICKET_ATTACHMENT_MAX_SIZE) {
      throw new Error(`Attachment ${index + 1} exceeds 2MB size limit`);
    }

    const dataUrlPattern = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
    if (!dataUrlPattern.test(dataUrl)) {
      throw new Error(`Attachment ${index + 1} content is invalid`);
    }

    return {
      name: name.slice(0, 120),
      mimeType,
      size,
      dataUrl,
      uploadedAt: new Date(),
    };
  });
}

// Realtime stream (SSE) for instant app updates
app.get("/events/stream", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const tokenPayload = await clerkClient.verifyToken(token, {
      clockSkewInMs: 10000,
    });

    if (!tokenPayload || !tokenPayload.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await clerkClient.users.getUser(tokenPayload.sub);
    const primaryEmail =
      (Array.isArray(user.emailAddresses) && user.emailAddresses[0]?.emailAddress) ||
      user.primaryEmailAddress?.emailAddress ||
      "";

    if (!primaryEmail) {
      return res.status(401).json({ error: "Unable to resolve user email" });
    }

    const clientId = crypto.randomUUID();
    const requestOrigin = req.headers.origin;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.flushHeaders?.();

    realtimeClients.set(clientId, {
      id: clientId,
      email: primaryEmail.toLowerCase(),
      role: user.publicMetadata?.role || "CUSTOMER",
      res,
    });

    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\n`);
        res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      } catch {
        clearInterval(heartbeat);
        realtimeClients.delete(clientId);
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      realtimeClients.delete(clientId);
    });
  } catch (err) {
    console.error("❌ SSE stream error:", err.message);
    if (!res.headersSent) {
      res.status(401).json({ error: "Authentication failed" });
    }
  }
});

async function generateTicketNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = Math.floor(Math.random() * 90000) + 10000;
  return `MS-${datePart}-${sequence}`;
}

/* ======================================
   ✅ USER PROFILE ROUTES (Clerk-based)
====================================== */

// Get current user profile from Clerk
app.get("/auth/profile", clerkAuth, async (req, res) => {
  try {
    const user = await clerkClient.users.getUser(req.user.id);
    const companyName = (user.publicMetadata?.companyName || "").toString();
    const hasCompanyNameSet = Boolean(
      user.publicMetadata?.hasCompanyNameSet || companyName.trim() !== ""
    );
    
    res.json({ 
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        companyName,
        hasCompanyNameSet,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile (company name)
app.put("/auth/profile", clerkAuth, async (req, res) => {
  try {
    const { companyName } = req.body;
    
    if (!companyName || companyName.trim() === "") {
      return res.status(400).json({ error: "Company name is required" });
    }

    // Get current user data to check if company name was already set
    const user = await clerkClient.users.getUser(req.user.id);
    const existingCompanyName = (user.publicMetadata?.companyName || "").toString();
    const hasCompanyNameSet = Boolean(
      user.publicMetadata?.hasCompanyNameSet || existingCompanyName.trim() !== ""
    );

    if (hasCompanyNameSet) {
      return res.status(403).json({ 
        error: "Company name can only be changed once. Please contact administrator to update."
      });
    }

    // Update user metadata in Clerk - preserve existing metadata
    await clerkClient.users.updateUser(req.user.id, {
      publicMetadata: { 
        ...user.publicMetadata,
        companyName: companyName.trim(),
        hasCompanyNameSet: true
      }
    });

    res.json({ 
      success: true,
      message: "Profile updated successfully",
      companyName: companyName.trim()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================
   ✅ TICKETING ROUTES
====================================== */

// Create a ticket (all authenticated users)
app.post("/tickets", clerkAuth, async (req, res) => {
  try {
    const { title, description, category, priority, attachments: rawAttachments } = req.body || {};
    let attachments = [];
    try {
      attachments = normalizeTicketAttachments(rawAttachments);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Ticket title is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Ticket description is required" });
    }

    const ticket = await Ticket.create({
      ticketNumber: await generateTicketNumber(),
      title: title.trim(),
      description: description.trim(),
      category: category || "GENERAL",
      priority: priority || "MEDIUM",
      createdBy: {
        userId: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        companyName: req.user.companyName || "",
      },
      attachments,
      comments: [
        {
          authorId: req.user.id,
          authorEmail: req.user.email,
          authorName: req.user.name,
          authorRole: req.user.role,
          message: "Ticket created",
          attachments,
        },
      ],
      lastUpdatedAt: new Date(),
    });

    await AuditLog.create({
      action: "TICKET_CREATED",
      user: req.user.email,
      details: {
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
      },
    });

    publishRealtimeUpdate("ticket.created", { ticketId: ticket._id.toString() });

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    console.error("❌ Ticket create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// List tickets (admins see all, others see only their own)
app.get("/tickets", clerkAuth, async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    if (req.user.role !== "ADMIN") {
      query["createdBy.userId"] = req.user.id;
    }

    const tickets = await Ticket.find(query).sort({ updatedAt: -1 }).limit(200);

    res.json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (err) {
    console.error("❌ Ticket list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get ticket details (admins all, others only own tickets)
app.get("/tickets/:ticketId", clerkAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const isOwner = ticket.createdBy?.userId === req.user.id;
    if (req.user.role !== "ADMIN" && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("❌ Ticket details error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add comment to a ticket (admins on all, users on own)
app.post("/tickets/:ticketId/comments", clerkAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, attachments: rawAttachments } = req.body || {};
    let attachments = [];
    try {
      attachments = normalizeTicketAttachments(rawAttachments);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedMessage && attachments.length === 0) {
      return res.status(400).json({ error: "Comment message or image attachment is required" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const isOwner = ticket.createdBy?.userId === req.user.id;
    if (req.user.role !== "ADMIN" && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    ticket.comments.push({
      authorId: req.user.id,
      authorEmail: req.user.email,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: trimmedMessage,
      attachments,
    });
    ticket.lastUpdatedAt = new Date();
    await ticket.save();

    publishRealtimeUpdate("ticket.commented", { ticketId: ticket._id.toString() });

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("❌ Ticket comment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update ticket status/assignment (admins only)
app.put("/tickets/:ticketId", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, priority, assignedTo } = req.body || {};
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const validStatus = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    const validPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"];

    if (status && !validStatus.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatus.join(", ")}` });
    }

    if (priority && !validPriority.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${validPriority.join(", ")}` });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo && typeof assignedTo === "object") {
      ticket.assignedTo = {
        userId: assignedTo.userId || "",
        email: assignedTo.email || "",
        name: assignedTo.name || "",
      };
    }
    ticket.lastUpdatedAt = new Date();

    ticket.comments.push({
      authorId: req.user.id,
      authorEmail: req.user.email,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: `Ticket updated${status ? `: status -> ${status}` : ""}${priority ? `, priority -> ${priority}` : ""}`,
    });

    await ticket.save();

    await AuditLog.create({
      action: "TICKET_UPDATED",
      user: req.user.email,
      details: {
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        priority: ticket.priority,
      },
    });

    publishRealtimeUpdate("ticket.updated", { ticketId: ticket._id.toString() });

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("❌ Ticket update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =============================
// Blockchain endpoints
// =============================
// Add a medicine transaction to the blockchain
app.post("/blockchain/add", clerkAuth, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Missing data" });
    const block = await blockchain.addBlock(data);
    res.json({ success: true, block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get the full blockchain
app.get("/blockchain/chain", clerkAuth, async (req, res) => {
  try {
    const chain = await blockchain.getChain();
    res.json({ success: true, chain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get list of companies (for transfer dropdown)
app.get("/companies/list", clerkAuth, async (req, res) => {
  try {
    const { role } = req.query;
    const currentUserEmail = req.user.email.toLowerCase();
    
    console.log("📋 Companies list request:");
    console.log("  Current user:", currentUserEmail);
    console.log("  Current user role:", req.user.role);
    console.log("  Role filter:", role || "none");
    
    // Get all users from Clerk
    const userListResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = userListResponse.data || userListResponse || [];
    
    console.log(`  Total users from Clerk: ${users.length}`);
    
    // Debug: log first few users
    users.slice(0, 3).forEach(u => {
      console.log(`  Sample user: ${u.emailAddresses[0]?.emailAddress}`, {
        role: u.publicMetadata?.role,
        companyName: u.publicMetadata?.companyName,
        metadata: u.publicMetadata
      });
    });
    
    // Filter and map to companies
    const companies = users
      .filter(u => {
        const userRole = u.publicMetadata?.role;
        const companyName = u.publicMetadata?.companyName;
        const userEmail = u.emailAddresses[0]?.emailAddress?.toLowerCase();
        
        // Exclude current user from list
        if (userEmail === currentUserEmail) {
          return false;
        }
        
        // Filter by role if specified
        if (role && userRole !== role) {
          return false;
        }
        
        // Only include users with company names and not customers
        const include = companyName && userRole !== 'CUSTOMER';
        if (include) {
          console.log(`  ✅ Including: ${userEmail} - ${companyName} (${userRole})`);
        }
        return include;
      })
      .map(u => ({
        email: u.emailAddresses[0]?.emailAddress,
        companyName: u.publicMetadata?.companyName,
        role: u.publicMetadata?.role
      }));

    console.log(`  ✅ Returning ${companies.length} companies`);

    res.json({ 
      success: true,
      count: companies.length,
      companies 
    });
  } catch (err) {
    console.error("❌ Companies list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update user role (requires Clerk Dashboard or Admin API)
app.put("/auth/role", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({ error: "userId and role are required" });
    }

    const validRoles = ["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "CUSTOMER", "ADMIN"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const user = await clerkClient.users.getUser(userId);

    // Update role while preserving existing metadata keys.
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...(user.publicMetadata || {}),
        role
      }
    });

    res.json({ 
      success: true,
      message: "User role updated successfully",
      userId,
      role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bootstrap first admin without requiring an existing ADMIN session.
// Protected with ADMIN_BOOTSTRAP_KEY to prevent unauthorized elevation.
function getBootstrapKey() {
  return process.env.ADMIN_BOOTSTRAP_KEY || "techanish";
}

function isBootstrapAuthorized(req) {
  const expectedKey = getBootstrapKey();
  const providedKey = req.headers["x-admin-bootstrap-key"] || req.body?.bootstrapKey;
  return Boolean(providedKey && providedKey === expectedKey);
}

async function promoteUserToAdmin(user, companyName) {
  await clerkClient.users.updateUser(user.id, {
    publicMetadata: {
      ...(user.publicMetadata || {}),
      role: "ADMIN",
      ...(typeof companyName === "string"
        ? { companyName: companyName.trim(), hasCompanyNameSet: true }
        : {})
    }
  });

  return clerkClient.users.getUser(user.id);
}

app.post("/admin/bootstrap", async (req, res) => {
  try {
    if (!isBootstrapAuthorized(req)) {
      return res.status(403).json({ error: "Invalid bootstrap key" });
    }

    const { email, userId, companyName, allowExistingAdmin } = req.body || {};
    if (!email && !userId) {
      return res.status(400).json({ error: "Provide either email or userId" });
    }

    const userListResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = userListResponse.data || userListResponse || [];

    const admins = users.filter((u) => u.publicMetadata?.role === "ADMIN");
    if (admins.length > 0 && !allowExistingAdmin) {
      return res.status(409).json({
        error: "An ADMIN user already exists. Set allowExistingAdmin=true to intentionally promote another admin.",
        admins: admins.map((u) => u.emailAddresses?.[0]?.emailAddress).filter(Boolean)
      });
    }

    let targetUser = null;
    if (userId) {
      targetUser = await clerkClient.users.getUser(userId);
    } else {
      const normalizedEmail = String(email).toLowerCase();
      targetUser = users.find(
        (u) => (u.emailAddresses?.[0]?.emailAddress || "").toLowerCase() === normalizedEmail
      );
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const updatedUser = await promoteUserToAdmin(targetUser, companyName);

    res.json({
      success: true,
      message: "Admin bootstrap successful",
      user: {
        userId: updatedUser.id,
        email: updatedUser.emailAddresses?.[0]?.emailAddress || "",
        role: updatedUser.publicMetadata?.role || "CUSTOMER",
        companyName: updatedUser.publicMetadata?.companyName || ""
      }
    });
  } catch (err) {
    console.error("❌ Admin bootstrap error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Bootstrap a dedicated test admin for QA/testing flows.
// Requires x-admin-bootstrap-key and defaults to test.admin@mediscan.com.
app.post("/admin/bootstrap/test", async (req, res) => {
  try {
    if (!isBootstrapAuthorized(req)) {
      return res.status(403).json({ error: "Invalid bootstrap key" });
    }

    const testEmail = String(req.body?.email || "test.admin@mediscan.com").toLowerCase();
    const companyName = req.body?.companyName || "MediScan Test Admin";
    const createIfMissing = req.body?.createIfMissing !== false;

    const userListResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = userListResponse.data || userListResponse || [];

    let targetUser = users.find(
      (u) => (u.emailAddresses?.[0]?.emailAddress || "").toLowerCase() === testEmail
    );

    if (!targetUser && createIfMissing) {
      try {
        targetUser = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          firstName: "Test",
          lastName: "Admin",
          publicMetadata: {
            role: "ADMIN",
            companyName,
            hasCompanyNameSet: true,
          },
        });
      } catch (createErr) {
        return res.status(500).json({
          error: "Failed to create test admin user in Clerk",
          message: createErr.message,
        });
      }
    }

    if (!targetUser) {
      return res.status(404).json({
        error: "Test admin user not found",
        message: "Set createIfMissing=true or create the user in Clerk first.",
      });
    }

    const updatedUser = await promoteUserToAdmin(targetUser, companyName);

    res.json({
      success: true,
      message: "Test admin is ready",
      user: {
        userId: updatedUser.id,
        email: updatedUser.emailAddresses?.[0]?.emailAddress || "",
        role: updatedUser.publicMetadata?.role || "CUSTOMER",
        companyName: updatedUser.publicMetadata?.companyName || "",
      },
    });
  } catch (err) {
    console.error("❌ Test admin bootstrap error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all platform users with core profile details
app.get("/admin/users", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const userListResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = userListResponse.data || userListResponse || [];

    const mapUser = (u) => {
      const email = u.emailAddresses?.[0]?.emailAddress || "";
      return {
        userId: u.id,
        email,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email || "User",
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        role: u.publicMetadata?.role || "CUSTOMER",
        companyName: u.publicMetadata?.companyName || "",
        createdAt: u.createdAt,
        banned: Boolean(u.banned || u.publicMetadata?.isBanned),
      };
    };

    const usersById = new Map();
    users.forEach((u) => usersById.set(u.id, mapUser(u)));

    // Some Clerk tenants may hide natively banned users from getUserList.
    // Recover them from audit trail so Admin can still unban.
    const auditedUserIds = await AuditLog.distinct("details.targetUserId", {
      action: { $in: ["ADMIN_USER_BANNED", "ADMIN_USER_UNBANNED"] },
      "details.targetUserId": { $exists: true, $ne: "" },
    });

    for (const id of auditedUserIds) {
      if (usersById.has(id)) continue;
      try {
        const user = await clerkClient.users.getUser(id);
        usersById.set(id, mapUser(user));
      } catch (err) {
        // User may have been deleted; ignore this record.
      }
    }

    const mappedUsers = Array.from(usersById.values()).sort((a, b) => a.email.localeCompare(b.email));

    res.json({
      success: true,
      count: mappedUsers.length,
      users: mappedUsers,
    });
  } catch (err) {
    console.error("❌ Admin users list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update a user's role/profile metadata (company name, names)
app.put("/admin/users/:userId", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, companyName, firstName, lastName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const validRoles = ["MANUFACTURER", "DISTRIBUTOR", "PHARMACY", "CUSTOMER", "ADMIN"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const user = await clerkClient.users.getUser(userId);

    const nextPublicMetadata = {
      ...(user.publicMetadata || {}),
      ...(role ? { role } : {}),
      ...(typeof companyName === "string" ? { companyName: companyName.trim(), hasCompanyNameSet: true } : {}),
    };

    const updatePayload = {
      publicMetadata: nextPublicMetadata,
      ...(typeof firstName === "string" ? { firstName: firstName.trim() } : {}),
      ...(typeof lastName === "string" ? { lastName: lastName.trim() } : {}),
    };

    await clerkClient.users.updateUser(userId, updatePayload);
    const updated = await clerkClient.users.getUser(userId);

    publishRealtimeUpdate("admin.user.updated", { userId: updated.id });

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        userId: updated.id,
        email: updated.emailAddresses?.[0]?.emailAddress || "",
        name: [updated.firstName, updated.lastName].filter(Boolean).join(" ") || updated.username || "User",
        firstName: updated.firstName || "",
        lastName: updated.lastName || "",
        role: updated.publicMetadata?.role || "CUSTOMER",
        companyName: updated.publicMetadata?.companyName || "",
      }
    });
  } catch (err) {
    console.error("❌ Admin user update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: ban/unban user account
app.put("/admin/users/:userId/status", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (typeof banned !== "boolean") {
      return res.status(400).json({ error: "banned must be a boolean" });
    }

    const current = await clerkClient.users.getUser(userId);

    // Keep ban state in metadata for consistent admin listing and recovery.
    // Only unban natively if user is already natively banned.
    if (!banned && current.banned && typeof clerkClient.users.unbanUser === "function") {
      try {
        await clerkClient.users.unbanUser(userId);
      } catch (clerkUnbanErr) {
        console.warn("⚠️ Clerk native unban failed, metadata flag will still be cleared:", clerkUnbanErr.message);
      }
    }

    // Always persist isBanned in metadata so UI and APIs remain consistent.
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...(current.publicMetadata || {}),
        isBanned: banned,
      }
    });

    const updated = await clerkClient.users.getUser(userId);

    await AuditLog.create({
      action: banned ? "ADMIN_USER_BANNED" : "ADMIN_USER_UNBANNED",
      user: req.user.email,
      details: {
        targetUserId: userId,
        targetEmail: updated.emailAddresses?.[0]?.emailAddress || "",
      },
    });

    publishRealtimeUpdate("admin.user.status.updated", { userId: updated.id, banned });

    res.json({
      success: true,
      message: banned ? "User banned successfully" : "User unbanned successfully",
      user: {
        userId: updated.id,
        email: updated.emailAddresses?.[0]?.emailAddress || "",
        banned: Boolean(updated.banned || updated.publicMetadata?.isBanned),
      },
    });
  } catch (err) {
    console.error("❌ Admin user status update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: overview cards and high-level metrics
app.get("/admin/overview", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const userListResponse = await clerkClient.users.getUserList({ limit: 500 });
    const users = userListResponse.data || userListResponse || [];

    const totalUsers = users.length;
    const bannedUsers = users.filter((u) => Boolean(u.banned || u.publicMetadata?.isBanned)).length;
    const usersByRole = users.reduce((acc, u) => {
      const role = u.publicMetadata?.role || "CUSTOMER";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const totalMedicines = await Medicine.countDocuments();
    const activeMedicines = await Medicine.countDocuments({ status: "ACTIVE" });
    const blockedMedicines = await Medicine.countDocuments({ status: "BLOCKED" });
    const soldOutMedicines = await Medicine.countDocuments({ status: "SOLD_OUT" });
    const totalScans = await ScanLog.countDocuments();
    const suspiciousScans = await ScanLog.countDocuments({ anomaly: true });
    const recentAuditEvents = await AuditLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    res.json({
      success: true,
      overview: {
        totalUsers,
        bannedUsers,
        usersByRole,
        totalMedicines,
        activeMedicines,
        blockedMedicines,
        soldOutMedicines,
        totalScans,
        suspiciousScans,
        recentAuditEvents,
      },
    });
  } catch (err) {
    console.error("❌ Admin overview error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: latest audit log feed
app.get("/admin/audit", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const audit = await AuditLog.find().sort({ timestamp: -1 }).limit(limit);
    res.json({
      success: true,
      count: audit.length,
      audit,
    });
  } catch (err) {
    console.error("❌ Admin audit fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: login sessions tracker
app.get("/admin/sessions", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const email = req.query.email ? String(req.query.email).toLowerCase() : "";
    const activeOnly = req.query.activeOnly === "true";

    const filter = {
      ...(email ? { email } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    };

    const sessions = await LoginSession.find(filter)
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (err) {
    console.error("❌ Admin sessions fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================
   ✅ MEDICINE ROUTES
====================================== */

// ✅ Get all medicines (with optional filtering)
app.get("/medicine/list", clerkAuth, async (req, res) => {
  try {
    console.log("📋 Fetching medicine list...");
    console.log("Query params:", req.query);
    console.log("User:", req.user?.email);
    console.log("User role:", req.user?.role);
    
    const { status, owner, batchID } = req.query;
    
    // If searching by batchID (for verification), return that specific medicine
    if (batchID) {
      const medicine = await Medicine.findOne({ batchID });
      console.log(`✅ Batch search for ${batchID}: ${medicine ? 'Found' : 'Not found'}`);
      return res.json({ 
        success: true, 
        count: medicine ? 1 : 0, 
        medicines: medicine ? [medicine] : []
      });
    }
    
    // Security: Customers see their purchase history
    if (req.user.role === 'CUSTOMER') {
      // See their purchase history
      const purchases = await Medicine.find({
        'ownerHistory.owner': new RegExp(`^${req.user.email}$`, 'i'),
        'ownerHistory.action': 'PURCHASED'
      }).sort({ createdAt: -1 });
      
      console.log(`✅ Found ${purchases.length} purchases for customer`);
      console.log(`   Medicine IDs: ${purchases.map(m => m.batchID).join(', ')}`);
      
      return res.json({ 
        success: true, 
        count: purchases.length, 
        medicines: purchases
      });
    }
    
    // Non-customers (MANUFACTURER, DISTRIBUTOR, PHARMACY) see their own medicines
    let filter = {};
    if (status) filter.status = status;
    
    if (owner) {
      // Case-insensitive email search
      // Show medicines where user is current owner OR has received units via transfer
      const ownerRegex = new RegExp(`^${owner}$`, 'i');
      
      filter.$or = [
        { currentOwner: ownerRegex },
        { 
          'ownerHistory': {
            $elemMatch: {
              owner: ownerRegex,
              action: 'TRANSFERRED',
              unitsPurchased: { $gt: 0 }
            }
          }
        }
      ];
    }
    
    console.log("Filter:", JSON.stringify(filter));
    
    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });
    console.log(`✅ Found ${medicines.length} medicines`);
    
    // Filter medicines to only show those where user has units available
    const medicinesWithUnits = medicines.filter(med => {
      const userEmail = (owner || req.user?.email || '').toLowerCase();
      
      console.log(`\n  Checking ${med.batchID} for user ${userEmail}:`);
      
      // Always calculate from ownerHistory for accurate tracking
      let receivedUnits = 0;
      let transferredOutUnits = 0;
      let soldUnits = 0;
      
      med.ownerHistory.forEach((h, idx) => {
        console.log(`    [${idx}] action: ${h.action}, owner: ${h.owner}, from: ${h.from}, units: ${h.unitsPurchased}`);
        
        // Units received by this user (either as manufacturer or via transfer)
        if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += med.totalUnits || 0;
          console.log(`      ✅ Original owner, total units: ${med.totalUnits}`);
        }
        if (h.action === 'TRANSFERRED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += h.unitsPurchased || 0;
          console.log(`      ✅ Received ${h.unitsPurchased} units`);
        }
        
        // Units transferred out by this user
        if (h.action === 'TRANSFERRED' && h.from && h.from.toLowerCase() === userEmail) {
          transferredOutUnits += h.unitsPurchased || 0;
          console.log(`      ❌ Transferred out ${h.unitsPurchased} units`);
        }
        
        // Units sold to customers by this user
        if (h.action === 'PURCHASED' && h.from && h.from.toLowerCase() === userEmail) {
          soldUnits += h.unitsPurchased || 0;
          console.log(`      💰 Sold ${h.unitsPurchased} units`);
        }
      });
      
      const availableUnits = receivedUnits - transferredOutUnits - soldUnits;
      console.log(`    Total: received ${receivedUnits} - transferred ${transferredOutUnits} - sold ${soldUnits} = ${availableUnits}`);
      
      const hasUnits = availableUnits > 0;
      console.log(`    Result: ${hasUnits ? '✅ SHOW' : '❌ HIDE'} (${availableUnits} units)`);
      return hasUnits;
    });
    
    console.log(`✅ Filtered to ${medicinesWithUnits.length} medicines with available units`);
    
    res.json({ success: true, count: medicinesWithUnits.length, medicines: medicinesWithUnits });
  } catch (err) {
    console.error("❌ Error fetching medicines:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Register Medicine (ONLY Manufacturer)
app.post("/medicine/register",
  clerkAuth,
  authorizeRoles("MANUFACTURER"),
  async (req, res) => {
    try {
      const { 
        batchID, name, manufacturer, manufacturerLocation, mfgDate, expDate, totalUnits,
        category, description, dosage, composition, price, location, reorderPoint
      } = req.body;

      // Validate required fields
      if (!batchID || !name || !manufacturer || !mfgDate || !expDate || !totalUnits) {
        return res.status(400).json({ 
          error: "Missing required fields",
          required: ["batchID", "name", "manufacturer", "mfgDate", "expDate", "totalUnits"]
        });
      }

      // Validate totalUnits is a positive number
      const units = parseInt(totalUnits, 10);
      if (isNaN(units) || units <= 0) {
        return res.status(400).json({ 
          error: "Invalid totalUnits",
          message: "totalUnits must be a positive number"
        });
      }

      const exists = await Medicine.findOne({ batchID });
      if (exists) return res.status(400).json({ error: "Batch already registered" });

      const med = await Medicine.create({
        batchID,
        name,
        manufacturer,
        mfgDate,
        expDate,
        totalUnits: units,
        remainingUnits: units, // Initially, all units are remaining
        currentOwner: req.user.email,
        status: "ACTIVE",
        // New fields with defaults
        category: category || "General",
        description: description || "",
        dosage: dosage || "",
        composition: composition || "",
        price: price || 0,
        location: manufacturerLocation || location || "",
        reorderPoint: reorderPoint || Math.floor(units * 0.2), // Default 20% of total
        ownerHistory: [
          { 
            owner: req.user.email, 
            role: req.user.role,
            ownerLocation: manufacturerLocation || location || "",
            action: "REGISTERED",
            unitsPurchased: 0
          }
        ]
      });

      // Create notification for successful registration
      await createNotification(
        req.user.email,
        'SYSTEM',
        'Medicine Registered',
        `Successfully registered ${name} (Batch: ${batchID}) with ${units} units`,
        batchID,
        'normal'
      );

      publishRealtimeUpdate("medicine.registered", { batchID: med.batchID });

      res.status(201).json({ 
        success: true,
        message: "✅ Medicine Registered", 
        medicine: med 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ Transfer Ownership (Manufacturer/Distributor/Pharmacy)
app.post("/medicine/transfer/:batchID",
  clerkAuth,
  authorizeRoles("MANUFACTURER", "DISTRIBUTOR", "PHARMACY"),
  async (req, res) => {
    try {
      const batchID = req.params.batchID;
      const { newOwnerEmail, newOwnerRole, unitsToTransfer, fromLocation, toLocation } = req.body;

      console.log("🔄 Transfer request:");
      console.log("  BatchID:", batchID);
      console.log("  Current user:", req.user.email);
      console.log("  New owner email:", newOwnerEmail);
      console.log("  New owner role:", newOwnerRole);
      console.log("  Units to transfer:", unitsToTransfer);
      console.log("  Transfer from location:", fromLocation || "N/A");
      console.log("  Transfer to location:", toLocation || "N/A");

      // Validate input
      if (!newOwnerEmail || !newOwnerRole || !unitsToTransfer) {
        return res.status(400).json({ 
          error: "Missing required fields",
          required: ["newOwnerEmail", "newOwnerRole", "unitsToTransfer"]
        });
      }

      const units = parseInt(unitsToTransfer);
      if (isNaN(units) || units <= 0) {
        return res.status(400).json({ error: "Invalid units to transfer" });
      }

      const med = await Medicine.findOne({ batchID });
      if (!med) {
        console.log("❌ Medicine not found with batchID:", batchID);
        return res.status(404).json({ error: "Batch not found" });
      }

      console.log("  Current owner in DB:", med.currentOwner);
      console.log("  Medicine status:", med.status);
      console.log("  Remaining units:", med.remainingUnits);

      if (med.status !== "ACTIVE") {
        return res.status(400).json({ error: "Medicine not ACTIVE" });
      }

      // Calculate available units for the user from ownerHistory
      const userEmail = (req.user.email || "").toLowerCase();
      
      console.log(`  Calculating available units for: ${userEmail}`);
      
      // Always calculate from ownerHistory for accurate tracking
      let receivedUnits = 0;
      let transferredOutUnits = 0;
      let soldUnits = 0;
      
      console.log(`  Checking owner history (${med.ownerHistory.length} entries):`);
      med.ownerHistory.forEach((h, idx) => {
        console.log(`    [${idx}] action: ${h.action}, owner: ${h.owner}, from: ${h.from}, units: ${h.unitsPurchased}`);
        
        // Units received (either as manufacturer or via transfer)
        if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += med.totalUnits || 0;
          console.log(`      ✅ Original owner, total units: ${med.totalUnits}`);
        }
        if (h.action === 'TRANSFERRED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += h.unitsPurchased || 0;
          console.log(`      ✅ Received ${h.unitsPurchased} units`);
        }
        
        // Units transferred out
        if (h.action === 'TRANSFERRED' && h.from && h.from.toLowerCase() === userEmail) {
          transferredOutUnits += h.unitsPurchased || 0;
          console.log(`      ❌ Transferred out ${h.unitsPurchased} units`);
        }
        
        // Units sold
        if (h.action === 'PURCHASED' && h.from && h.from.toLowerCase() === userEmail) {
          soldUnits += h.unitsPurchased || 0;
          console.log(`      💰 Sold ${h.unitsPurchased} units`);
        }
      });
      
      const availableUnits = receivedUnits - transferredOutUnits - soldUnits;
      console.log(`  Total: received ${receivedUnits} - transferred out ${transferredOutUnits} - sold ${soldUnits} = ${availableUnits}`);

      console.log("  Available units for user:", availableUnits);

      // Check if enough units available
      if (availableUnits < units) {
        return res.status(400).json({ 
          error: "Insufficient units",
          available: availableUnits,
          requested: units
        });
      }

      // Only original owner or someone who received units can transfer
      if (availableUnits === 0) {
        console.log(`❌ Transfer denied: ${req.user.email} has no units to transfer`);
        return res.status(403).json({ 
          error: "You don't have any units of this medicine to transfer",
          currentOwner: med.currentOwner,
          requestedBy: req.user.email
        });
      }

      const transferTime = new Date();
      const transferId = `tx_${crypto.randomUUID()}`;
      const transferNonce = crypto.randomBytes(16).toString("hex");
      const initiatedByIp = getClientIp(req);
      const initiatedByUserAgent = req.get("user-agent") || "UNKNOWN";

      const canonicalTransferPayload = {
        eventType: "MEDICINE_TRANSFER",
        version: "1.0",
        transferId,
        batchID: med.batchID,
        medicineName: med.name,
        fromOwner: req.user.email,
        fromRole: req.user.role,
        toOwner: newOwnerEmail,
        toRole: newOwnerRole,
        units,
        fromLocation: fromLocation || med.location || "",
        toLocation: toLocation || "",
        transferTime: transferTime.toISOString(),
        transferNonce,
        initiatedByIp,
        initiatedByUserAgent
      };

      const transferPayloadHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(canonicalTransferPayload))
        .digest("hex");

      const transferSignature = crypto
        .createHmac(
          "sha256",
          process.env.BLOCKCHAIN_EVENT_SECRET || process.env.QR_SECRET || "mediscan-transfer-signing-key"
        )
        .update(transferPayloadHash)
        .digest("hex");

      let blockchainBlock;
      try {
        blockchainBlock = await blockchain.addBlock({
          ...canonicalTransferPayload,
          transferPayloadHash,
          transferSignature
        });
      } catch (blockchainErr) {
        console.error("❌ Blockchain write failed. Transfer aborted:", blockchainErr.message);
        return res.status(502).json({
          error: "Blockchain service unavailable. Transfer was not saved to keep ledger and database in sync."
        });
      }

      const blockchainTimestamp = parseBlockchainTimestamp(blockchainBlock.timestamp, transferTime);

      // If manufacturer is transferring, reduce their remainingUnits
      if (med.currentOwner.toLowerCase() === userEmail) {
        med.remainingUnits -= units;
        console.log(`  Manufacturer transfer: reduced remainingUnits to ${med.remainingUnits}`);
      } else {
        console.log(`  Distributor/Pharmacy transfer: units tracked in ownerHistory only`);
      }

      // Add to history with units transferred
      med.ownerHistory.push({
        owner: newOwnerEmail,
        role: newOwnerRole || "UNKNOWN",
        ownerLocation: toLocation || "",
        action: "TRANSFERRED",
        unitsPurchased: units,
        from: req.user.email,
        fromLocation: fromLocation || med.location || "",
        time: transferTime,
        transferId,
        transferNonce,
        transferPayloadHash,
        transferSignature,
        initiatedByIp,
        initiatedByUserAgent,
        blockchainStatus: "CONFIRMED",
        blockchainIndex: blockchainBlock.index,
        blockchainHash: blockchainBlock.hash || "",
        blockchainPreviousHash: blockchainBlock.previous_hash || "",
        blockchainTimestamp
      });

      // Keep latest known stock location on the batch.
      if (toLocation) {
        med.location = toLocation;
      }

      await med.save();

      console.log(`✅ Transfer successful: ${units} units from ${req.user.email} → ${newOwnerEmail}`);

      // Create notifications for both parties
      await createNotification(
        newOwnerEmail,
        'TRANSFER_RECEIVED',
        'Medicine Transfer Received',
        `You received ${units} units of ${med.name} (Batch: ${batchID}) from ${req.user.email}`,
        batchID,
        'normal'
      );

      await createNotification(
        req.user.email,
        'SYSTEM',
        'Transfer Completed',
        `Successfully transferred ${units} units of ${med.name} (Batch: ${batchID}) to ${newOwnerEmail}`,
        batchID,
        'normal'
      );

      publishRealtimeUpdate("medicine.transferred", { batchID: med.batchID });

      res.json({ 
        success: true,
        message: `✅ ${units} units transferred successfully`, 
        medicine: med,
        blockchain: {
          status: "CONFIRMED",
          transferId,
          blockIndex: blockchainBlock.index,
          blockHash: blockchainBlock.hash,
          previousHash: blockchainBlock.previous_hash,
          blockTimestamp: blockchainTimestamp
        }
      });
    } catch (err) {
      console.error("❌ Transfer error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ Purchase/Reduce Stock (Pharmacy/Current Owner)
app.post("/medicine/purchase/:batchID",
  clerkAuth,
  authorizeRoles("PHARMACY", "DISTRIBUTOR", "MANUFACTURER"),
  async (req, res) => {
    try {
      const batchID = req.params.batchID;
      const { customerEmail } = req.body;
      
      // Parse unitsPurchased as integer
      const unitsPurchased = parseInt(req.body.unitsPurchased, 10);

      console.log("🛒 Purchase request:");
      console.log("  BatchID:", batchID);
      console.log("  Units to purchase:", unitsPurchased);
      console.log("  Customer email:", customerEmail);
      console.log("  Current user:", req.user.email);

      // Validate input
      if (isNaN(unitsPurchased) || unitsPurchased <= 0) {
        return res.status(400).json({ 
          error: "Invalid units",
          message: "unitsPurchased must be a positive number"
        });
      }

      const med = await Medicine.findOne({ batchID });
      if (!med) return res.status(404).json({ error: "Batch not found" });

      console.log("  Before purchase - Remaining units:", med.remainingUnits);

      if (med.status !== "ACTIVE") {
        return res.status(400).json({ error: "Medicine not ACTIVE" });
      }

      // Calculate available units for the user
      const userEmail = (req.user.email || "").toLowerCase();
      
      console.log(`  Calculating available units for: ${userEmail}`);
      
      // Always calculate from ownerHistory for accurate tracking
      let receivedUnits = 0;
      let transferredOutUnits = 0;
      let soldUnits = 0;
      
      med.ownerHistory.forEach(h => {
        // Units received (either as manufacturer or via transfer)
        if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += med.totalUnits || 0;
        }
        if (h.action === 'TRANSFERRED' && h.owner.toLowerCase() === userEmail) {
          receivedUnits += h.unitsPurchased || 0;
        }
        // Units transferred out
        if (h.action === 'TRANSFERRED' && h.from && h.from.toLowerCase() === userEmail) {
          transferredOutUnits += h.unitsPurchased || 0;
        }
        // Units sold to customers
        if (h.action === 'PURCHASED' && h.from && h.from.toLowerCase() === userEmail) {
          soldUnits += h.unitsPurchased || 0;
        }
      });
      
      const availableUnits = receivedUnits - transferredOutUnits - soldUnits;
      console.log(`  Received: ${receivedUnits}, transferred out: ${transferredOutUnits}, sold: ${soldUnits}, available: ${availableUnits}`);

      console.log(`  Available units for sale: ${availableUnits}`);

      // Check if user has any units to sell
      if (availableUnits === 0) {
        return res.status(403).json({ 
          error: "You don't have any units of this medicine to sell",
          currentOwner: med.currentOwner,
          requestedBy: req.user.email
        });
      }

      // Check if enough units are available
      if (availableUnits < unitsPurchased) {
        return res.status(400).json({ 
          error: `Insufficient stock. Only ${availableUnits} units available`,
          message: `Only ${availableUnits} units available`
        });
      }

      // Only reduce remainingUnits if seller is the manufacturer
      if (med.currentOwner.toLowerCase() === userEmail) {
        med.remainingUnits -= unitsPurchased;
        console.log(`  Manufacturer sale: reduced remainingUnits to ${med.remainingUnits}`);
      } else {
        console.log(`  Distributor/Pharmacy sale: units tracked in ownerHistory only`);
      }
      
      console.log("  After purchase - Remaining units:", med.remainingUnits);
      
      // Update status if sold out
      if (med.remainingUnits === 0) {
        med.status = "SOLD_OUT";
      }

      // Add to owner history
      med.ownerHistory.push({
        owner: customerEmail || DEFAULT_CUSTOMER_EMAIL,
        role: "CUSTOMER",
        action: "PURCHASED",
        unitsPurchased: unitsPurchased,
        from: req.user.email
      });

      await med.save();

      console.log(`✅ Purchase successful: ${unitsPurchased} units sold to ${customerEmail || 'CUSTOMER'}`);

      // Create notifications
      if (customerEmail && customerEmail !== DEFAULT_CUSTOMER_EMAIL) {
        await createNotification(
          customerEmail,
          'SALE_COMPLETED',
          'Medicine Purchased',
          `You purchased ${unitsPurchased} units of ${med.name} (Batch: ${batchID})`,
          batchID,
          'normal'
        );
      }

      await createNotification(
        req.user.email,
        'SALE_COMPLETED',
        'Sale Completed',
        `Sold ${unitsPurchased} units of ${med.name} (Batch: ${batchID})`,
        batchID,
        'normal'
      );

      publishRealtimeUpdate("medicine.purchased", { batchID: med.batchID });

      res.json({ 
        success: true,
        message: `✅ ${unitsPurchased} units sold`, 
        medicine: med 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ Block Medicine (Admin)
app.post("/medicine/block/:batchID",
  clerkAuth,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const batchID = req.params.batchID;
      const { reason } = req.body;

      const med = await Medicine.findOne({ batchID });
      if (!med) return res.status(404).json({ error: "Batch not found" });

      med.status = "BLOCKED";
      med.blockReason = reason || "Blocked by admin";
      
      // Add to history
      med.ownerHistory.push({
        owner: req.user.email,
        role: req.user.role,
        action: "BLOCKED",
        unitsPurchased: 0,
        notes: reason || "Blocked by admin"
      });

      await med.save();

      // Notify current owner
      await createNotification(
        med.currentOwner,
        'MEDICINE_BLOCKED',
        'Medicine Blocked',
        `${med.name} (Batch: ${batchID}) has been blocked. Reason: ${reason || 'Not specified'}`,
        batchID,
        'urgent'
      );

      res.json({ 
        success: true,
        message: "✅ Medicine BLOCKED", 
        medicine: med 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ QR Code Generation (Any logged-in user can generate)
app.get("/medicine/qrcode/:batchID", clerkAuth, async (req, res) => {
  try {
    const batchID = req.params.batchID;

    const med = await Medicine.findOne({ batchID });
    if (!med) return res.status(404).json({ error: "Batch not found" });

    const sig = signBatch(batchID);
    const baseURL = process.env.FRONTEND_URL || `http://localhost:${process.env.PORT}`;
    const qrURL = `${baseURL}/medicine/verify/${batchID}?sig=${sig}`;

    const qr = await QRCode.toDataURL(qrURL);
    res.json({ 
      success: true,
      batchID, 
      qrURL, 
      qr 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Verify Medicine (Public - no auth required)
app.get("/medicine/verify/:batchID", async (req, res) => {
  try {
    const batchID = req.params.batchID;
    const sig = req.query.sig;
    const location = req.query.location || "UNKNOWN";
    const deviceId = req.query.deviceId || "UNKNOWN";
    const user = req.query.user || "UNKNOWN";

    const expectedSig = signBatch(batchID);
    if (!sig || sig !== expectedSig) {
      await ScanLog.create({
        batchID,
        result: "❌ FAKE (QR tampered)",
        scanner: "UNKNOWN",
        location,
        deviceId,
        user,
        anomaly: true
      });
      await AuditLog.create({
        action: "QR_VERIFICATION_FAIL",
        user,
        batchID,
        details: { reason: "QR tampered/invalid", location, deviceId }
      });
      return res.json({ 
        success: false,
        batchID, 
        result: "❌ FAKE (QR tampered/invalid)" 
      });
    }

    const med = await Medicine.findOne({ batchID });
    if (!med) {
      await ScanLog.create({
        batchID,
        result: "❌ FAKE (Not Registered)",
        scanner: "UNKNOWN",
        location,
        deviceId,
        user,
        anomaly: true
      });
      await AuditLog.create({
        action: "QR_VERIFICATION_FAIL",
        user,
        batchID,
        details: { reason: "Not Registered", location, deviceId }
      });
      return res.json({ 
        success: false,
        batchID, 
        result: "❌ FAKE (Not Registered)" 
      });
    }

    if (med.status === "BLOCKED") {
      await ScanLog.create({
        batchID,
        result: "❌ BLOCKED",
        scanner: "UNKNOWN",
        location,
        deviceId,
        user,
        anomaly: true
      });
      await AuditLog.create({
        action: "QR_VERIFICATION_FAIL",
        user,
        batchID,
        details: { reason: "BLOCKED", location, deviceId }
      });
      return res.json({ 
        success: false,
        batchID, 
        result: "❌ BLOCKED Medicine", 
        details: med 
      });
    }

    // External registry check
    const { checkBatchWithExternalRegistry } = require("./utils/externalApi");
    const extCheck = await checkBatchWithExternalRegistry(batchID);
    // Tamper-evident packaging check
    const { verifyTamperEvidence } = require("./utils/tamperPackaging");
    const packagingCode = req.query.packagingCode || req.body?.packagingCode;
    const tamperValid = verifyTamperEvidence(batchID, packagingCode);
    // AI Trust Score
    const { score, reasons } = await calculateTrustScore(batchID);
    const anomaly = score < 70 || !extCheck.valid || !tamperValid;

    // Log scan
    await ScanLog.create({
      batchID,
      result: anomaly ? "⚠️ SUSPICIOUS" : "✅ GENUINE",
      scanner: user,
      location,
      deviceId,
      user,
      anomaly
    });

    // Update trust score and integrity hash
    med.trustScore = score;
    med.integrityHash = computeIntegrityHash(med);
    await med.save();

    // Audit log
    await AuditLog.create({
      action: "QR_VERIFICATION",
      user,
      batchID,
      details: { location, deviceId, score, reasons }
    });

    // Real-time notification for suspicious activity
    if (anomaly) {
      // Example: notify admin (replace with actual admin email)
      sendNotification(
        process.env.ADMIN_NOTIFY_EMAIL || "admin@example.com",
        `Suspicious QR Scan Detected: ${batchID}`,
        `A suspicious scan was detected for batch ${batchID} at location ${location} with device ${deviceId}.\nReasons: ${reasons.join(", ")}`
      ).catch(console.error);
    }

    // Role-based data view
    let role = req.user?.role || req.user?.publicMetadata?.role || "CUSTOMER";
    const filteredMed = filterMedicineByRole(med.toObject ? med.toObject() : med, role);
    const { getMessage } = require("./utils/i18n");
    const lang = req.query.lang || "en";
    res.json({
      success: true,
      batchID,
      result: anomaly ? getMessage("suspicious", lang) : getMessage("verified", lang),
      trustScore: score,
      reasons: !tamperValid ? ["Failed tamper-evident packaging check", ...reasons] : (extCheck.valid ? reasons : ["Failed external registry check", ...reasons]),
      details: filteredMed,
      ownerHistory: filteredMed.ownerHistory,
      externalRegistry: extCheck,
      tamperPackaging: tamperValid
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get Scan Logs (Admin)
app.get("/logs", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const logs = await ScanLog.find().sort({ time: -1 });
    res.json({ 
      success: true,
      count: logs.length,
      logs 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================
   ✅ ANALYTICS & STATISTICS ROUTES
====================================== */

// ✅ Dashboard Statistics
app.get("/analytics/dashboard", clerkAuth, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.user.role;

    let stats = {};

    if (userRole === 'ADMIN') {
      // Admin sees system-wide stats
      const totalMedicines = await Medicine.countDocuments();
      const activeBatches = await Medicine.countDocuments({ status: 'ACTIVE' });
      const blockedBatches = await Medicine.countDocuments({ status: 'BLOCKED' });
      const totalScans = await ScanLog.countDocuments();
      const genuineScans = await ScanLog.countDocuments({ result: /GENUINE/ });
      const fakeScans = await ScanLog.countDocuments({ result: /FAKE/ });

      // Get recent activity
      const recentScans = await ScanLog.find().sort({ time: -1 }).limit(10);
      
      // Medicines expiring soon (next 90 days)
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      const expiringSoon = await Medicine.countDocuments({
        status: 'ACTIVE',
        expDate: { $lte: ninetyDaysFromNow.toISOString().split('T')[0] }
      });

      stats = {
        totalMedicines,
        activeBatches,
        blockedBatches,
        totalScans,
        genuineScans,
        fakeScans,
        expiringSoon,
        recentScans
      };
    } else if (userRole === 'CUSTOMER') {
      // Customer stats
      const purchases = await Medicine.find({
        'ownerHistory.owner': new RegExp(`^${userEmail}$`, 'i'),
        'ownerHistory.action': 'PURCHASED'
      });

      let totalPurchased = 0;
      let totalSpent = 0;
      purchases.forEach(med => {
        med.ownerHistory.forEach(h => {
          if (h.action === 'PURCHASED' && h.owner.toLowerCase() === userEmail) {
            totalPurchased += h.unitsPurchased || 0;
            totalSpent += (h.unitsPurchased || 0) * (med.price || 0);
          }
        });
      });

      stats = {
        totalPurchases: purchases.length,
        totalUnitsPurchased: totalPurchased,
        totalSpent: totalSpent.toFixed(2),
        uniqueMedicines: purchases.length
      };
    } else {
      // Manufacturer, Distributor, Pharmacy stats
      const ownedMedicines = await Medicine.find({ 
        currentOwner: new RegExp(`^${userEmail}$`, 'i') 
      });

      let totalUnits = 0;
      let totalValue = 0;
      let lowStock = 0;
      let expiringSoon = 0;

      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      ownedMedicines.forEach(med => {
        totalUnits += med.remainingUnits || 0;
        totalValue += (med.remainingUnits || 0) * (med.price || 0);
        
        if (med.remainingUnits <= med.reorderPoint) {
          lowStock++;
        }

        if (new Date(med.expDate) <= ninetyDaysFromNow) {
          expiringSoon++;
        }
      });

      // Count transfers made
      const transfersMade = await Medicine.countDocuments({
        'ownerHistory': {
          $elemMatch: {
            from: new RegExp(`^${userEmail}$`, 'i'),
            action: 'TRANSFERRED'
          }
        }
      });

      stats = {
        totalBatches: ownedMedicines.length,
        totalUnits,
        totalValue: totalValue.toFixed(2),
        lowStock,
        expiringSoon,
        transfersMade,
        activeBatches: ownedMedicines.filter(m => m.status === 'ACTIVE').length
      };
    }

    res.json({ success: true, stats, role: userRole });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get expiring medicines (with days until expiry)
app.get("/analytics/expiring", clerkAuth, async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.user.role;

    const daysFromNow = new Date();
    daysFromNow.setDate(daysFromNow.getDate() + parseInt(days));

    let query = {
      status: 'ACTIVE',
      expDate: { $lte: daysFromNow.toISOString().split('T')[0] }
    };

    // Non-admin users see only their medicines
    if (userRole !== 'ADMIN') {
      query.currentOwner = new RegExp(`^${userEmail}$`, 'i');
    }

    const medicines = await Medicine.find(query).sort({ expDate: 1 });

    // Calculate days until expiry for each
    const withDays = medicines.map(med => {
      const expDate = new Date(med.expDate);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      
      return {
        ...med.toObject(),
        daysUntilExpiry,
        isExpired: daysUntilExpiry < 0
      };
    });

    res.json({ 
      success: true, 
      count: withDays.length,
      medicines: withDays 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get low stock medicines
app.get("/analytics/low-stock", clerkAuth, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const userRole = req.user.role;

    let query = {
      status: 'ACTIVE',
      $expr: { $lte: ['$remainingUnits', '$reorderPoint'] }
    };

    // Non-admin users see only their medicines
    if (userRole !== 'ADMIN') {
      query.currentOwner = new RegExp(`^${userEmail}$`, 'i');
    }

    const medicines = await Medicine.find(query).sort({ remainingUnits: 1 });

    res.json({ 
      success: true, 
      count: medicines.length,
      medicines 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================
   ✅ NOTIFICATION ROUTES
====================================== */

// ✅ Get user notifications
app.get("/notifications", clerkAuth, async (req, res) => {
  try {
    const { unreadOnly = false, limit = 50 } = req.query;
    const userId = req.user.email;

    let query = { userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ userId, read: false });

    res.json({ 
      success: true, 
      count: notifications.length,
      unreadCount,
      notifications 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Mark notification as read
app.put("/notifications/:id/read", clerkAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.email },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    publishRealtimeUpdate("notification.read", { notificationId: notification._id.toString() });

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Mark all notifications as read
app.put("/notifications/read-all", clerkAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.email, read: false },
      { read: true }
    );

    publishRealtimeUpdate("notification.read_all", { userId: req.user.email });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete notification
app.delete("/notifications/:id", clerkAuth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.email 
    });

    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Helper function to create notification
async function createNotification(userId, type, title, message, batchID = "", priority = "normal", metadata = {}) {
  try {
    const created = await Notification.create({
      userId,
      type,
      title,
      message,
      batchID,
      priority,
      metadata
    });
    publishRealtimeUpdate("notification.created", {
      notificationId: created._id.toString(),
      userId,
      type,
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

// ✅ Check and create expiry/low stock alerts (background job - call this periodically)
app.post("/analytics/check-alerts", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    let alertsCreated = 0;

    // Check for expiring medicines (30, 60, 90 days)
    const medicines = await Medicine.find({ status: 'ACTIVE' });
    
    for (const med of medicines) {
      const expDate = new Date(med.expDate);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

      // Alert at 90, 60, and 30 days
      if ([90, 60, 30].includes(daysUntilExpiry)) {
        await createNotification(
          med.currentOwner,
          'EXPIRY_ALERT',
          `Medicine Expiring in ${daysUntilExpiry} Days`,
          `${med.name} (Batch: ${med.batchID}) will expire on ${med.expDate}`,
          med.batchID,
          daysUntilExpiry <= 30 ? 'high' : 'normal'
        );
        alertsCreated++;
      }

      // Low stock alert
      if (med.remainingUnits <= med.reorderPoint && med.remainingUnits > 0) {
        await createNotification(
          med.currentOwner,
          'LOW_STOCK',
          'Low Stock Alert',
          `${med.name} (Batch: ${med.batchID}) has only ${med.remainingUnits} units remaining`,
          med.batchID,
          'high'
        );
        alertsCreated++;
      }
    }

    res.json({ 
      success: true, 
      message: `Created ${alertsCreated} alerts`,
      alertsCreated 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    path: req.path 
  });
});

const PORT = process.env.PORT || 5000;

console.log(`📝 Attempting to start server on port ${PORT}...`);

try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`✅ Server address:`, server.address());
  });

  server.on('error', (error) => {
    console.error('❌ Server failed to start:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
    }
    process.exit(1);
  });

  server.on('listening', () => {
    console.log('✅ Server is now listening for connections');
  });
} catch (error) {
  console.error('❌ Fatal error starting server:', error);
  process.exit(1);
}
