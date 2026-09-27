import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

/**
 * Checks if request is from localhost in development or during test runs.
 */
const isDevOrTest = (req: Request): boolean => {
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.NODE_ENV !== "production") {
    const ip = req.ip || req.socket.remoteAddress || "";
    if (ip.includes("127.0.0.1") || ip.includes("::1") || ip === "localhost") {
      return true;
    }
  }
  return false;
};

/**
 * Standard rate limiter for general API routes.
 * 300 requests per 15 minutes per IP in production.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests from this IP. Please try again after 15 minutes.",
      },
    });
  },
});

/**
 * Strict rate limiter for authentication routes (register, etc.).
 * 30 attempts per 15 minutes per IP in production.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: "AUTH_RATE_LIMIT_EXCEEDED",
        message: "Too many authentication attempts. Please try again after 15 minutes.",
      },
    });
  },
});

/**
 * Rate limiter for OTP resend requests (C4).
 * Enforces a maximum of 3 resends per 15 minutes per IP or email.
 */
interface AbuseTrackerRecord {
  count: number;
  resetAt: number;
}

class InactivityAbuseTracker {
  private records = new Map<string, AbuseTrackerRecord>();
  private readonly windowMs: number;
  private readonly maxLimit: number;

  constructor(windowMs: number, maxLimit: number) {
    this.windowMs = windowMs;
    this.maxLimit = maxLimit;
  }

  private getKeys(ip: string, email?: string): string[] {
    const keys: string[] = [];
    if (ip) keys.push(`ip:${ip}`);
    if (email) keys.push(`email:${email.toLowerCase().trim()}`);
    return keys;
  }

  public check(ip: string, email?: string): { allowed: boolean; remainingSeconds?: number } {
    const now = Date.now();
    const keys = this.getKeys(ip, email);

    for (const key of keys) {
      const record = this.records.get(key);
      if (record) {
        if (now > record.resetAt) {
          this.records.delete(key);
        } else if (record.count >= this.maxLimit) {
          const remainingSeconds = Math.ceil((record.resetAt - now) / 1000);
          return { allowed: false, remainingSeconds };
        }
      }
    }
    return { allowed: true };
  }

  public increment(ip: string, email?: string): void {
    const now = Date.now();
    const keys = this.getKeys(ip, email);

    for (const key of keys) {
      const record = this.records.get(key);
      if (!record || now > record.resetAt) {
        this.records.set(key, { count: 1, resetAt: now + this.windowMs });
      } else {
        record.count += 1;
      }
    }
  }

  public reset(ip: string, email?: string): void {
    const keys = this.getKeys(ip, email);
    for (const key of keys) {
      this.records.delete(key);
    }
  }

  public clearAll(): void {
    this.records.clear();
  }
}

// C3: Login Brute-Force Tracker (5 failed attempts per 15 minutes)
export const loginBruteForceTracker = new InactivityAbuseTracker(15 * 60 * 1000, 5);

export const loginBruteForceGuard = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
  const email = typeof req.body?.email === "string" ? req.body.email : undefined;

  const check = loginBruteForceTracker.check(ip, email);
  if (!check.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: "LOGIN_RATE_LIMIT_EXCEEDED",
        message: "Too many failed login attempts. Please try again after 15 minutes.",
        remainingSeconds: check.remainingSeconds,
      },
    });
    return;
  }

  next();
};

// C4: OTP Resend Rate Limiter (3 resend requests per 15 minutes)
export const otpResendTracker = new InactivityAbuseTracker(15 * 60 * 1000, 3);

export const otpResendLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
  const email = typeof req.body?.email === "string" ? req.body.email : undefined;

  const check = otpResendTracker.check(ip, email);
  if (!check.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: "OTP_RESEND_RATE_LIMIT_EXCEEDED",
        message: "Too many OTP resend requests. Please try again after 15 minutes.",
        remainingSeconds: check.remainingSeconds,
      },
    });
    return;
  }

  otpResendTracker.increment(ip, email);
  next();
};

// C5: Password Reset Limiter (10 requests per 15 minutes to allow forgot-password + 5 code attempts)
export const passwordResetTracker = new InactivityAbuseTracker(15 * 60 * 1000, 10);

export const passwordResetLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
  const email = typeof req.body?.email === "string" ? req.body.email : undefined;

  const check = passwordResetTracker.check(ip, email);
  if (!check.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
        message: "Too many password reset requests. Please try again after 15 minutes.",
        remainingSeconds: check.remainingSeconds,
      },
    });
    return;
  }

  passwordResetTracker.increment(ip, email);
  next();
};

// B8: Email Change Request Limiter (5 requests per 15 minutes)
export const emailChangeRequestTracker = new InactivityAbuseTracker(15 * 60 * 1000, 5);

export const emailChangeRequestLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (isDevOrTest(req)) return next();
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
  const email = typeof req.body?.newEmail === "string" ? req.body.newEmail : undefined;

  const check = emailChangeRequestTracker.check(ip, email);
  if (!check.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: "EMAIL_CHANGE_RATE_LIMIT_EXCEEDED",
        message: "Too many email change requests. Please try again after 15 minutes.",
        remainingSeconds: check.remainingSeconds,
      },
    });
    return;
  }

  emailChangeRequestTracker.increment(ip, email);
  next();
};

// B8: Email Change Verification Limiter (10 attempts per 15 minutes)
export const emailChangeVerifyTracker = new InactivityAbuseTracker(15 * 60 * 1000, 10);

export const emailChangeVerifyLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (isDevOrTest(req)) return next();
  const ip = req.ip || req.socket.remoteAddress || "unknown_ip";

  const check = emailChangeVerifyTracker.check(ip);
  if (!check.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: "EMAIL_VERIFY_RATE_LIMIT_EXCEEDED",
        message: "Too many email verification attempts. Please try again after 15 minutes.",
        remainingSeconds: check.remainingSeconds,
      },
    });
    return;
  }

  emailChangeVerifyTracker.increment(ip);
  next();
};

