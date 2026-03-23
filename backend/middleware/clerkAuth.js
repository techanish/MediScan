const { clerkClient } = require("@clerk/clerk-sdk-node");
const LoginSession = require("../models/LoginSession");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "UNKNOWN";
}

async function trackSession(req, user, tokenPayload) {
  try {
    const sessionId = tokenPayload.sid || tokenPayload.session_id || "";
    const tokenId = tokenPayload.jti || "";
    const key = sessionId || tokenId;
    if (!key) return;

    const now = new Date();
    const filter = sessionId ? { userId: user.id, sessionId } : { userId: user.id, tokenId };
    const existing = await LoginSession.findOne(filter).select("lastSeenAt");

    // Throttle writes to reduce database churn for high-frequency API usage.
    if (existing && now.getTime() - new Date(existing.lastSeenAt).getTime() < 30 * 1000) {
      return;
    }

    await LoginSession.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          userId: user.id,
          email: user.email,
          role: user.role,
          sessionId,
          tokenId,
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") || "UNKNOWN",
          firstSeenAt: now,
        },
        $set: {
          email: user.email,
          role: user.role,
          ipAddress: getClientIp(req),
          userAgent: req.get("user-agent") || "UNKNOWN",
          lastSeenAt: now,
          lastPath: req.originalUrl || req.path || "",
          isActive: true,
        }
      },
      { upsert: true, new: true }
    );
  } catch (sessionErr) {
    // Do not block request flow due to telemetry/session tracking issues.
    console.error("Session tracking error:", sessionErr.message);
  }
}

/**
 * Clerk Authentication Middleware
 * Verifies the session token and attaches user info to req.user
 */
async function clerkAuth(req, res, next) {
  try {
    const sessionToken = req.headers.authorization?.replace("Bearer ", "");
    
    if (!sessionToken) {
      return res.status(401).json({ error: "No session token provided" });
    }

    // Verify the session token with Clerk using verifyToken
    // Add clock tolerance to handle minor time sync issues
    let tokenPayload;
    try {
      tokenPayload = await clerkClient.verifyToken(sessionToken, {
        clockSkewInMs: 10000 // Allow 10 seconds of clock skew
      });
    } catch (verifyError) {
      // Provide more specific error messages
      if (verifyError.message?.includes('expired')) {
        return res.status(401).json({ error: "Session token expired", message: "Please sign in again" });
      }
      if (verifyError.message?.includes('invalid')) {
        return res.status(401).json({ error: "Invalid session token", message: "Authentication failed" });
      }
      throw verifyError; // Re-throw unknown errors
    }
    
    if (!tokenPayload || !tokenPayload.sub) {
      return res.status(401).json({ error: "Invalid session token" });
    }

    // Get user details from Clerk
    const user = await clerkClient.users.getUser(tokenPayload.sub);
    
    // Safely determine the user's primary email address
    const primaryEmail =
      (Array.isArray(user.emailAddresses) &&
        user.emailAddresses.length > 0 &&
        user.emailAddresses[0] &&
        user.emailAddresses[0].emailAddress) ||
      (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) ||
      null;

    if (!primaryEmail) {
      return res.status(400).json({
        error: "User email not found",
        message: "No email address is associated with this account",
      });
    }
    
    // Attach user info to request
    req.user = {
      id: user.id,
      email: primaryEmail,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.username || 'User',
      role: user.publicMetadata?.role || "CUSTOMER", // Role stored in Clerk user metadata
      companyName: user.publicMetadata?.companyName || ""
    };

    if (user.publicMetadata?.isBanned) {
      return res.status(403).json({
        error: "Account is banned",
        message: "Please contact the administrator"
      });
    }

    req.auth = {
      sessionId: tokenPayload.sid || tokenPayload.session_id || "",
      tokenId: tokenPayload.jti || "",
      issuedAt: tokenPayload.iat,
      expiresAt: tokenPayload.exp,
    };

    await trackSession(req, req.user, tokenPayload);

    next();
  } catch (err) {
    console.error("Clerk auth error:", err);
    return res.status(401).json({ 
      error: "Authentication failed", 
      message: err.message || "Unable to verify session"
    });
  }
}

/**
 * Role-based authorization middleware
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Access denied", 
        message: `Required roles: ${allowedRoles.join(", ")}. Your role: ${req.user.role}` 
      });
    }
    next();
  };
}

module.exports = { clerkAuth, authorizeRoles };
