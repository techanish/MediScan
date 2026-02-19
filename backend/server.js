const { autoBlockSuspiciousBatches } = require("./utils/incidentResponse");
// ✅ Admin: Automate Incident Response (Auto-block)
app.post("/dashboard/incident-response", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { threshold } = req.body;
    const blocked = await autoBlockSuspiciousBatches(threshold || 5);
    res.json({ success: true, blocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { generateCertificate } = require("./utils/certificates");
// ✅ Generate Digital Certificate for Batch
app.post("/certificate", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { batchID, owner } = req.body;
    if (!batchID || !owner) return res.status(400).json({ error: "batchID and owner required" });
    const cert = generateCertificate(batchID, owner);
    res.json({ success: true, certificate: cert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { retrainFraudModel } = require("./utils/mlTraining");
// ✅ Admin: Retrain Fraud Detection Model
app.post("/dashboard/retrain-ml", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { newData } = req.body;
    const result = await retrainFraudModel(newData || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { getComplianceIssues } = require("./utils/compliance");
// ✅ Regulatory Compliance Check (Admin)
app.get("/dashboard/compliance", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const issues = await getComplianceIssues();
    res.json({ success: true, issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const Feedback = require("./models/Feedback");
// ✅ User Feedback/Dispute Submission
app.post("/feedback", clerkAuth, async (req, res) => {
  try {
    const { batchID, message } = req.body;
    const user = req.user.id || req.user.sub || req.user._id;
    const feedback = await Feedback.create({ user, batchID, message });
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: List All Feedback/Disputes
app.get("/feedback", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json({ success: true, feedbacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin: Update Feedback/Dispute Status
app.put("/feedback/:id", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { status } = req.body;
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status, updatedAt: new Date() }, { new: true });
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { getAnalytics } = require("./utils/analytics");
// ✅ Analytics & Reporting Dashboard (Admin)
app.get("/dashboard/analytics", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const analytics = await getAnalytics();
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { getOfflinePayload, verifyOfflinePayload } = require("./utils/offlineVerification");
// ✅ Mobile: Get Offline Verification Payload for a Batch
app.get("/mobile/offline-payload/:batchID", clerkAuth, async (req, res) => {
  try {
    const med = await Medicine.findOne({ batchID: req.params.batchID });
    if (!med) return res.status(404).json({ error: "Batch not found" });
    res.json({ success: true, payload: getOfflinePayload(med) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Mobile: Sync Offline Scan Logs
app.post("/mobile/sync-scan-logs", clerkAuth, async (req, res) => {
  try {
    const logs = req.body.logs || [];
    let saved = 0;
    for (const log of logs) {
      // Optionally verify integrity here
      await ScanLog.create(log);
      saved++;
    }
    res.json({ success: true, saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ✅ Mobile: Get Scan History for User
app.get("/mobile/scan-history", clerkAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub || req.user._id;
    const logs = await ScanLog.find({ user: userId }).sort({ time: -1 });
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const { getScanLocations } = require("./utils/geoDashboard");
// ✅ Geolocation Visualization Dashboard (Admin)
app.get("/dashboard/geo", clerkAuth, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const locations = await getScanLocations();
    res.json({ success: true, locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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
const { clerkAuth, authorizeRoles } = require("./middleware/clerkAuth");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { calculateTrustScore, computeIntegrityHash } = require("./ai/fraudDetection");
const AuditLog = require("./models/AuditLog");
const { sendNotification } = require("./utils/notification");
const { filterMedicineByRole } = require("./utils/roleViews");

// Constants
const DEFAULT_CUSTOMER_EMAIL = "CUSTOMER";

const app = express();

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://10.9.5.204:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`⚠️  CORS blocked origin: ${origin}`);
      callback(null, true); // Allow all in development
    }
  },
  credentials: true
}));

app.use(express.json());
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

/* ======================================
   ✅ USER PROFILE ROUTES (Clerk-based)
====================================== */

// Get current user profile from Clerk
app.get("/auth/profile", clerkAuth, async (req, res) => {
  try {
    const user = await clerkClient.users.getUser(req.user.id);
    
    res.json({ 
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        companyName: user.publicMetadata?.companyName || ""
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
    const hasCompanyNameSet = user.publicMetadata?.hasCompanyNameSet || false;

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

    // Update user metadata in Clerk
    await clerkClient.users.updateUser(userId, {
      publicMetadata: { role }
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
        batchID, name, manufacturer, mfgDate, expDate, totalUnits,
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
        location: location || "",
        reorderPoint: reorderPoint || Math.floor(units * 0.2), // Default 20% of total
        ownerHistory: [
          { 
            owner: req.user.email, 
            role: req.user.role,
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
      const { newOwnerEmail, newOwnerRole, unitsToTransfer } = req.body;

      console.log("🔄 Transfer request:");
      console.log("  BatchID:", batchID);
      console.log("  Current user:", req.user.email);
      console.log("  New owner email:", newOwnerEmail);
      console.log("  New owner role:", newOwnerRole);
      console.log("  Units to transfer:", unitsToTransfer);

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
        action: "TRANSFERRED",
        unitsPurchased: units,
        from: req.user.email
      });

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

      res.json({ 
        success: true,
        message: `✅ ${units} units transferred successfully`, 
        medicine: med 
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
          error: "Insufficient stock",
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
    await Notification.create({
      userId,
      type,
      title,
      message,
      batchID,
      priority,
      metadata
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
