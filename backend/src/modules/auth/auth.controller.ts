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

  /**
   * OAuth Status Configuration Check
   */
  getOAuthConfig(req: Request, res: Response): void {
    sendSuccess(res, {
      googleConfigured: Boolean(envConfig.GOOGLE_CLIENT_ID && envConfig.GOOGLE_CLIENT_SECRET),
      appleConfigured: Boolean(envConfig.APPLE_CLIENT_ID),
      facebookConfigured: Boolean(envConfig.FACEBOOK_APP_ID),
    });
  }

  /**
   * Google OAuth Entrypoint (prompts account chooser)
   */
  async googleOAuth(req: Request, res: Response): Promise<void> {
    const isPopup = req.query.popup === "1";
    if (isPopup) {
      res.cookie("oauth_popup", "1", { httpOnly: true, maxAge: 10 * 60 * 1000 });
    }

    if (!envConfig.GOOGLE_CLIENT_ID || !envConfig.GOOGLE_CLIENT_SECRET) {
      res.redirect(`${envConfig.FRONTEND_URL}/auth/google-chooser?provider=google${isPopup ? "&popup=1" : ""}`);
      return;
    }

    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const redirectUri = envConfig.GOOGLE_CALLBACK_URL;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      client_id: envConfig.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "select_account",
      scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    });

    res.redirect(`${rootUrl}?${params.toString()}`);
  }

  /**
   * Google OAuth Callback
   */
  async googleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const code = req.query.code as string;
    const isPopup = req.cookies?.oauth_popup === "1" || req.query.popup === "1";
    res.clearCookie("oauth_popup");

    if (!code) {
      if (isPopup) {
        res.send(`
          <!DOCTYPE html><html><body><script>
            window.opener && window.opener.postMessage({ type: "OAUTH_ERROR", message: "Sign in was cancelled." }, "*");
            window.close();
          </script></body></html>
        `);
        return;
      }
      res.redirect(`${envConfig.FRONTEND_URL}/login?error=oauth_denied`);
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: envConfig.GOOGLE_CLIENT_ID,
          client_secret: envConfig.GOOGLE_CLIENT_SECRET,
          redirect_uri: envConfig.GOOGLE_CALLBACK_URL,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new BadRequestError("Failed to obtain Google access token.");
      }

      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userRes.json();

      if (!profile.email) {
        throw new BadRequestError("Google profile did not contain an email address.");
      }

      const result = await authService.socialLogin({
        email: profile.email,
        name: profile.name || profile.given_name || "Google User",
        provider: "google",
        providerId: profile.id,
      });

      res.cookie(SESSION_COOKIE_NAME, result.token, COOKIE_OPTIONS);
      res.cookie("token", result.token, COOKIE_OPTIONS);

      if (isPopup) {
        res.send(`
          <!DOCTYPE html>
          <html>
            <head><title>Signed In</title></head>
            <body style="background:#131314;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
              <p>Signing in to QuickPDF...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: "OAUTH_SUCCESS",
                    token: ${JSON.stringify(result.token)},
                    user: ${JSON.stringify(result.user)}
                  }, "*");
                  window.close();
                } else {
                  window.location.href = "${envConfig.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(result.token)}&user=${encodeURIComponent(JSON.stringify(result.user))}";
                }
              </script>
            </body>
          </html>
        `);
        return;
      }

      const redirectTarget = `${envConfig.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(result.token)}&user=${encodeURIComponent(JSON.stringify(result.user))}`;
      res.redirect(redirectTarget);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dev Mode Mock OAuth Endpoint
   */
  async mockOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, provider } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new BadRequestError("A valid email is required for social login.");
      }

      const result = await authService.socialLogin({
        email,
        name: name || email.split("@")[0],
        provider: provider || "google",
      });

      res.cookie(SESSION_COOKIE_NAME, result.token, COOKIE_OPTIONS);
      res.cookie("token", result.token, COOKIE_OPTIONS);

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Send verification code / OTP to user's Google or social email address
   */
  async sendSocialConfirmationCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, provider } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new BadRequestError("A valid email address is required.");
      }

      const result = await authService.sendSocialConfirmationCode({
        email,
        name,
        provider: provider || "google",
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * 1-Click Email confirmation endpoint
   */
  async confirmLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, token } = req.body;
      if (!email || !token) {
        throw new BadRequestError("Email and confirmation token are required.");
      }

      const result = await authService.confirmLoginByToken(email, token);

      res.cookie(SESSION_COOKIE_NAME, result.token, COOKIE_OPTIONS);
      res.cookie("token", result.token, COOKIE_OPTIONS);

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Check if user email has been verified/confirmed by magic link
   */
  async checkConfirmStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.query.email as string;
      if (!email) {
        throw new BadRequestError("Email query parameter required.");
      }

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user) {
        sendSuccess(res, { confirmed: false });
        return;
      }

      // If user is verified and has no pending OTP request, it is confirmed!
      const confirmed = user.isVerified && !user.otp;
      let sessionData = null;

      if (confirmed) {
        const { rawToken } = await sessionService.createSession(user.id);
        res.cookie(SESSION_COOKIE_NAME, rawToken, COOKIE_OPTIONS);
        res.cookie("token", rawToken, COOKIE_OPTIONS);
        sessionData = {
          user: authService.toUserDto(user),
          token: rawToken,
        };
      }

      sendSuccess(res, { confirmed, session: sessionData });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
