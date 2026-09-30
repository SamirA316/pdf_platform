import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.validation";
import { sendSuccess } from "../../common/responses/apiResponse";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../../common/errors/AppError";
import { envConfig } from "../../common/config";
import { AuthRequest, SESSION_COOKIE_NAME, extractAuthToken } from "../../middlewares/auth.middleware";
import { sessionService } from "./session.service";
import { securityEventService } from "../users/security-event.service";
import { prisma } from "../../common/prisma";
import {
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_OPTIONS,
  generateCsrfToken,
} from "../../middlewares/csrf.middleware";
import { loginBruteForceTracker } from "../../middlewares/rateLimiter.middleware";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: envConfig.NODE_ENV === "production",
  sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  getCsrfToken(req: Request, res: Response): void {
    let token = req.cookies?.[CSRF_COOKIE_NAME];
    if (!token) {
      token = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    }
    sendSuccess(res, { csrfToken: token });
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid registration input.");
      }

      const result = await authService.register(parsed.data);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid verification input.");
      }

      const result = await authService.verifyOtp(parsed.data);
      res.cookie(SESSION_COOKIE_NAME, result.token, COOKIE_OPTIONS);
      res.cookie("token", result.token, COOKIE_OPTIONS); // Backwards compatibility
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = resendOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid email.");
      }

      const result = await authService.resendOtp(parsed.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const email = typeof req.body?.email === "string" ? req.body.email : undefined;

    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid login credentials.");
      }

      const result = await authService.login(parsed.data);
      // Reset brute-force counter on successful authentication
      loginBruteForceTracker.reset(ip, email);

      res.cookie(SESSION_COOKIE_NAME, result.token, COOKIE_OPTIONS);
      res.cookie("token", result.token, COOKIE_OPTIONS); // Backwards compatibility
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof UnauthorizedError && err.code === "INVALID_CREDENTIALS") {
        loginBruteForceTracker.increment(ip, email);
      }
      next(err);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const user = await authService.getProfile(req.userId);
      sendSuccess(res, { user, sessionId: req.sessionId });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = extractAuthToken(req);
      if (token) {
        const tokenHash = sessionService.hashSessionToken(token);
        const session = await prisma.session.findUnique({ where: { tokenHash } });
        if (session) {
          await securityEventService.record({
            userId: session.userId,
            type: "LOGOUT",
          });
        }
        await sessionService.revokeSession(token);
      } else if (req.userId) {
        await securityEventService.record({
          userId: req.userId,
          type: "LOGOUT",
        });
      }

      const clearOptions = {
        httpOnly: true,
        secure: envConfig.NODE_ENV === "production",
        sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
        path: "/",
      };

      res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
      res.clearCookie("pdf_session", clearOptions);
      res.clearCookie("token", clearOptions);
      res.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);

      sendSuccess(res, { message: "Successfully logged out." });
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid email address.");
      }

      const result = await authService.forgotPassword(parsed.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid reset input.");
      }

      const result = await authService.resetPassword(parsed.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async mockOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (envConfig.NODE_ENV === "production") {
        throw new BadRequestError("Mock OAuth is strictly disallowed in production.");
      }

      const { provider } = req.params;
      const { email, name } = req.body;

      if (!email || !name) {
        throw new BadRequestError("Mock OAuth requires name and email in request body.");
      }

      // In dev, find or create user and return session
      const result = await authService.register({
        name: `${name} (${provider})`,
        email,
        password: "DevOAuthPassword123!",
      }).catch(async () => {
        // If already exists, return login
        return authService.login({ email, password: "DevOAuthPassword123!" });
      });

      sendSuccess(res, { provider, result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * B1 & B2: List active sessions for authenticated user
   */
  async getSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const rawToken = extractAuthToken(req) || undefined;
      const sessions = await sessionService.getUserSessions(req.userId, req.sessionId, rawToken);

      res.json({
        success: true,
        sessions,
        data: { sessions },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * B3: Revoke a specific session owned by authenticated user
   */
  async revokeSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const paramId = req.params.sessionId;
      const sessionId = Array.isArray(paramId) ? paramId[0] : paramId;
      if (!sessionId || typeof sessionId !== "string") {
        throw new BadRequestError("Session ID is required.");
      }

      const success = await sessionService.revokeSessionById(sessionId, req.userId);
      if (!success) {
        throw new NotFoundError("Session not found or access denied.");
      }

      await securityEventService.record({
        userId: req.userId,
        type: "SESSION_REVOKED",
      });

      // If user revoked their currently active session, clear session cookies
      if (req.sessionId && req.sessionId === sessionId) {
        const clearOptions = {
          httpOnly: true,
          secure: envConfig.NODE_ENV === "production",
          sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
          path: "/",
        };
        res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
        res.clearCookie("pdf_session", clearOptions);
        res.clearCookie("token", clearOptions);
      }

      res.json({
        success: true,
        message: "Session successfully revoked.",
        data: { message: "Session successfully revoked." },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * B4: Logout all other sessions while preserving current session
   */
  async revokeAllOtherSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId || !req.sessionId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const revokedCount = await sessionService.revokeAllOtherSessions(req.userId, req.sessionId);

      await securityEventService.record({
        userId: req.userId,
        type: "ALL_SESSIONS_REVOKED",
      });

      res.json({
        success: true,
        revokedCount,
        data: { revokedCount },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * B5 & B6: Change password, verifying old password and revoking other sessions
   */
  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid password input.");
      }

      const result = await authService.changePassword(req.userId, req.sessionId, parsed.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
