import { Router } from "express";
import { requireStrictAuth } from "../../middlewares/auth.middleware";
import {
  emailChangeRequestLimiter,
  emailChangeVerifyLimiter,
} from "../../middlewares/rateLimiter.middleware";
import { userController } from "./user.controller";

const router = Router();

/**
 * GET /api/v1/users/me (A1)
 * Retrieves authenticated user profile.
 */
router.get("/me", requireStrictAuth, (req, res, next) =>
  userController.getProfile(req, res, next)
);

/**
 * PATCH /api/v1/users/me (A2)
 * Updates authenticated user profile.
 */
router.patch("/me", requireStrictAuth, (req, res, next) =>
  userController.updateProfile(req, res, next)
);

/**
 * GET /api/v1/users/me/security-events (D4, D5, D6)
 * Retrieves security activity events for the authenticated user.
 */
router.get("/me/security-events", requireStrictAuth, (req, res, next) =>
  userController.getSecurityEvents(req, res, next)
);

/**
 * POST /api/v1/users/me/email/change-request (B1)
 * Initiates an email change request and sends OTP to the new email address.
 */
router.post(
  "/me/email/change-request",
  requireStrictAuth,
  emailChangeRequestLimiter,
  (req, res, next) => userController.requestEmailChange(req, res, next)
);

/**
 * POST /api/v1/users/me/email/verify (B3)
 * Verifies OTP and atomically updates email, revoking all other sessions.
 */
router.post(
  "/me/email/verify",
  requireStrictAuth,
  emailChangeVerifyLimiter,
  (req, res, next) => userController.verifyEmailChange(req, res, next)
);

/**
 * POST /api/v1/users/me/deactivate (C1)
 * Deactivates user account, marks inactive, and revokes all sessions.
 */
router.post("/me/deactivate", requireStrictAuth, (req, res, next) =>
  userController.deactivateAccount(req, res, next)
);

/**
 * DELETE /api/v1/users/me (C4)
 * Permanently deletes user account, cascades dependent records and revokes sessions.
 */
router.delete("/me", requireStrictAuth, (req, res, next) =>
  userController.deleteAccount(req, res, next)
);

export default router;

