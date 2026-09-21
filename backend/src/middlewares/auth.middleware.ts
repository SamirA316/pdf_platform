import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../common/prisma";
import { UnauthorizedError } from "../common/errors/AppError";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

export const GUEST_USER_ID = "guest-user-account";

let guestUserEnsured = false;
async function ensureGuestUser() {
  if (guestUserEnsured) return;
  try {
    const existing = await prisma.user.findUnique({ where: { id: GUEST_USER_ID } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: GUEST_USER_ID,
          name: "Guest User",
          email: "guest@pdfplatform.local",
          password: "guest-password-hash",
          isVerified: true,
        },
      });
    }
    guestUserEnsured = true;
  } catch (err) {
    console.error("Failed to ensure guest user in DB:", err);
  }
}

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * requireAuth: Authenticates logged-in users or transparently assigns a guest user ID
 * so public PDF tools (Convert, Merge, Protect, Unlock, etc.) work without forced login.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token && req.query?.token) {
      token = req.query.token as string;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        req.userId = decoded.id;
        next();
        return;
      } catch {
        // Fallback to guest if token expired or invalid
      }
    }

    await ensureGuestUser();
    req.userId = GUEST_USER_ID;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal authentication error" });
  }
};

/**
 * requireStrictAuth: Strictly requires a valid JWT token.
 * Used for authenticated endpoints like account settings (/api/auth/me) and files (/api/v1/files).
 */
export const requireStrictAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token && req.query?.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return next(new UnauthorizedError("Authentication required.", "UNAUTHORIZED"));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    req.userId = decoded.id;
    next();
  } catch (error) {
    return next(new UnauthorizedError("Invalid or expired authentication token.", "UNAUTHORIZED"));
  }
};

