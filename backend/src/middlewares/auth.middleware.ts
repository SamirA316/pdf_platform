import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../common/prisma";
import { UnauthorizedError } from "../common/errors/AppError";
import { envConfig } from "../common/config";
import { sessionService } from "../modules/auth/session.service";
import { logger } from "../common/logger";

export const GUEST_USER_ID = "guest-user-account";
export const SESSION_COOKIE_NAME =
  envConfig.NODE_ENV === "production" ? "__Host-pdf_session" : "pdf_session";

let guestUserEnsured = false;
async function ensureGuestUser() {
  if (guestUserEnsured) return;
  try {
    const existing = await prisma.user.findUnique({ where: { id: GUEST_USER_ID } });
    if (!existing) {
      // Use an unguessable 64-character random string so the guest account cannot be logged into directly
      const unguessablePassword = crypto.randomBytes(32).toString("hex");
      await prisma.user.create({
        data: {
          id: GUEST_USER_ID,
          name: "Guest User",
          email: "guest@pdfplatform.local",
          password: unguessablePassword,
          isVerified: true,
        },
      });
    }
    guestUserEnsured = true;
  } catch {
    logger.error("Failed to ensure guest user in DB.", "AUTH");
  }
}

export interface AuthRequest extends Request {
  userId?: string | undefined;
  sessionId?: string | undefined;
  sessionToken?: string | undefined;
  user?: { id: string } | undefined;
}

/**
 * Extracts session or bearer token from cookies or Authorization header.
 * Disallows query-string token authentication to avoid URL token leaks.
 */
export function extractAuthToken(req: Request): string | null {
  let token =
    req.cookies?.[SESSION_COOKIE_NAME] ||
    req.cookies?.pdf_session ||
    req.cookies?.token;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  return token || null;
}

/**
 * requireAuth: Authenticates logged-in users via server-side session or transparently
 * assigns a guest user ID for legacy public PDF tools.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractAuthToken(req);

    if (token) {
      const sessionResult = await sessionService.validateSession(token);
      if (sessionResult.valid && sessionResult.userId) {
        req.userId = sessionResult.userId;
        req.sessionId = sessionResult.sessionId;
        req.sessionToken = token;
        req.user = { id: sessionResult.userId };
        return next();
      }
    }

    await ensureGuestUser();
    req.userId = GUEST_USER_ID;
    req.user = { id: GUEST_USER_ID };
    next();
  } catch {
    logger.error("Auth middleware error.", "AUTH");
    res.status(500).json({ error: "Internal authentication error" });
  }
};

/**
 * requireStrictAuth: Strictly requires an active, non-expired, non-revoked session.
 * Tokens are accepted exclusively via HttpOnly cookie or Authorization Bearer header.
 * Stateless JWT fallback is completely removed in Phase 2.4A.
 */
export const requireStrictAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractAuthToken(req);

    if (!token) {
      return next(new UnauthorizedError("Authentication required.", "UNAUTHORIZED"));
    }

    const sessionResult = await sessionService.validateSession(token);

    if (sessionResult.valid && sessionResult.userId) {
      req.userId = sessionResult.userId;
      req.sessionId = sessionResult.sessionId;
      req.sessionToken = token;
      req.user = { id: sessionResult.userId };
      return next();
    }

    if (sessionResult.reason === "REVOKED") {
      return next(
        new UnauthorizedError("Session has been revoked. Please log in again.", "SESSION_REVOKED")
      );
    }

    if (sessionResult.reason === "EXPIRED") {
      return next(
        new UnauthorizedError("Session has expired. Please log in again.", "SESSION_EXPIRED")
      );
    }

    // Invalid or unknown session token
    return next(new UnauthorizedError("Invalid or expired authentication session.", "UNAUTHORIZED"));
  } catch (error) {
    return next(new UnauthorizedError("Invalid authentication session.", "UNAUTHORIZED"));
  }
};

