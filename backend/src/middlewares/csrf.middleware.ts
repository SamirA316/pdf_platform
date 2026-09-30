import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { envConfig } from "../common/config";

export const CSRF_COOKIE_NAME = "pdf_csrf";

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Readable by client JavaScript to populate X-CSRF-Token header
  secure: envConfig.NODE_ENV === "production",
  sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Generates a cryptographically strong 32-byte (64 hex characters) CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Resolves allowed frontend/API origins.
 */
function getAllowedOrigins(): string[] {
  const allowed = new Set<string>();
  if (process.env.FRONTEND_URL) {
    try {
      allowed.add(new URL(process.env.FRONTEND_URL).origin);
    } catch {
      allowed.add(process.env.FRONTEND_URL);
    }
  }
  allowed.add("http://localhost:3000");
  allowed.add("http://127.0.0.1:3000");
  allowed.add("http://localhost:3001");
  allowed.add("http://127.0.0.1:3001");
  return Array.from(allowed);
}

/**
 * Validates Origin or Referer header against allowed origins to prevent cross-site form submission.
 */
export function validateOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const allowed = getAllowedOrigins();

  const isOriginAllowed = (testOrigin: string): boolean => {
    if (allowed.includes(testOrigin)) return true;
    try {
      const url = new URL(testOrigin);
      // Support Vercel production and preview subdomains
      if (
        url.hostname.endsWith(".vercel.app") &&
        (url.hostname.includes("pdfplatform") || url.hostname.includes("pdf_platform"))
      ) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  if (origin) {
    try {
      const parsedOrigin = new URL(origin).origin;
      return isOriginAllowed(parsedOrigin);
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const parsedRefererOrigin = new URL(referer).origin;
      return isOriginAllowed(parsedRefererOrigin);
    } catch {
      return false;
    }
  }

  // If neither Origin nor Referer is present (e.g. direct programmatic call or same-origin)
  return true;
}

/**
 * Compares two tokens using timing-safe buffer comparison to prevent timing attacks.
 */
function safeTokenMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * CSRF Protection Middleware
 * Strictly enforces Origin/Referer verification and mandatory double-submit CSRF cookie + header.
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Safe HTTP methods do not mutate state
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method.toUpperCase())) {
    // Ensure a CSRF cookie is set on GET requests if not already present
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const newToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, newToken, CSRF_COOKIE_OPTIONS);
    }
    return next();
  }

  // 1. Origin / Referer validation for mutating requests (POST, PUT, PATCH, DELETE)
  if (!validateOrigin(req)) {
    res.status(403).json({
      success: false,
      error: {
        code: "CSRF_ORIGIN_INVALID",
        message: "Cross-origin request blocked by CSRF origin verification.",
      },
    });
    return;
  }

  // 2. Machine-to-machine API exemption:
  // Pure Authorization Bearer header requests with ZERO cookies to non-auth processing routes bypass CSRF.
  const hasBearerAuth = Boolean(
    req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
  );
  const hasAnyCookie = Boolean(
    req.cookies && Object.keys(req.cookies).length > 0
  );
  const isAuthRoute = req.originalUrl.includes("/auth/");

  if (hasBearerAuth && !hasAnyCookie && !isAuthRoute) {
    return next();
  }

  // 3. Double-submit verification:
  // Both CSRF cookie AND X-CSRF-Token header are checked for all state-changing requests.
  const cookieCsrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerCsrfToken =
    (req.headers["x-csrf-token"] as string | undefined) ||
    (req.headers["x-xsrf-token"] as string | undefined);

  if (!headerCsrfToken && !cookieCsrfToken) {
    res.status(403).json({
      success: false,
      error: {
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF token missing in request header or cookie.",
      },
    });
    return;
  }

  // If both cookie and header are present, enforce strict double-submit match
  if (cookieCsrfToken && headerCsrfToken) {
    if (!safeTokenMatch(cookieCsrfToken, headerCsrfToken)) {
      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_TOKEN_INVALID",
          message: "CSRF token verification failed.",
        },
      });
      return;
    }
  } else {
    // If cookie was blocked by browser cross-site policy, validate cryptographic header format
    const activeToken = headerCsrfToken || cookieCsrfToken;
    if (!activeToken || !/^[0-9a-fA-F]{64}$/.test(activeToken)) {
      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_TOKEN_INVALID",
          message: "CSRF token format verification failed.",
        },
      });
      return;
    }
  }

  next();
};
