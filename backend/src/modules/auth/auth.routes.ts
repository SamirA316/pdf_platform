import { Router } from "express";
import { authController } from "./auth.controller";
import { requireStrictAuth } from "../../middlewares/auth.middleware";
import {
  authLimiter,
  loginBruteForceGuard,
  otpResendLimiter,
  passwordResetLimiter,
} from "../../middlewares/rateLimiter.middleware";

const router = Router();

// CSRF token retrieval endpoint (C1)
router.get("/csrf", (req, res) => authController.getCsrfToken(req, res));

// Sensitive public authentication endpoints
router.post("/register", authLimiter, (req, res, next) => authController.register(req, res, next));
router.post("/verify-otp", authLimiter, (req, res, next) => authController.verifyOtp(req, res, next));
router.post("/resend-otp", authLimiter, otpResendLimiter, (req, res, next) => authController.resendOtp(req, res, next));
router.post("/login", authLimiter, loginBruteForceGuard, (req, res, next) => authController.login(req, res, next));
router.post("/logout", (req, res, next) => authController.logout(req, res, next));

// Password recovery endpoints (C5)
router.post("/forgot-password", authLimiter, passwordResetLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
router.post("/reset-password", authLimiter, passwordResetLimiter, (req, res, next) => authController.resetPassword(req, res, next));

// Authenticated session profile endpoint
router.get("/me", requireStrictAuth, (req, res, next) => authController.getMe(req, res, next));

// Session management endpoints (Phase 2.4B)
router.get("/sessions", requireStrictAuth, (req, res, next) => authController.getSessions(req, res, next));
router.post("/sessions/revoke-all", requireStrictAuth, (req, res, next) => authController.revokeAllOtherSessions(req, res, next));
router.post("/sessions/:sessionId/revoke", requireStrictAuth, (req, res, next) => authController.revokeSession(req, res, next));

// Password change endpoint (Phase 2.4B)
router.post("/change-password", requireStrictAuth, authLimiter, (req, res, next) => authController.changePassword(req, res, next));

export default router;
