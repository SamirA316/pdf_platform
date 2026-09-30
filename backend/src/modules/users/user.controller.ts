import { Response, NextFunction } from "express";
import { AuthRequest, SESSION_COOKIE_NAME } from "../../middlewares/auth.middleware";
import { userService } from "./user.service";
import { emailChangeService } from "./email-change.service";
import { envConfig } from "../../common/config";
import {
  updateProfileSchema,
  requestEmailChangeSchema,
  verifyEmailChangeSchema,
  deactivateAccountSchema,
  deleteAccountSchema,
  getSecurityEventsQuerySchema,
} from "./user.schema";
import { securityEventService } from "./security-event.service";
import { sendSuccess } from "../../common/responses/apiResponse";
import { BadRequestError, UnauthorizedError } from "../../common/errors/AppError";

export class UserController {
  /**
   * GET /api/v1/users/me (A1)
   * Fetches profile for the currently authenticated session user.
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const user = await userService.getProfile(userId);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/users/me (A2)
   * Updates profile fields for the currently authenticated session user.
   * A3: Derives user identity strictly from authenticated session (req.user.id), ignoring body/params.
   * A4: Mass assignment protection enforced at controller and service layers.
   */
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Invalid profile input.",
          "VALIDATION_ERROR"
        );
      }

      const updatedUser = await userService.updateProfile(userId, {
        name: parsed.data.name,
      });

      res.status(200).json({
        success: true,
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/users/me/email/change-request (B1)
   * Requests email change, validates availability, and sends OTP.
   */
  async requestEmailChange(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = requestEmailChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Invalid email format.",
          "VALIDATION_ERROR"
        );
      }

      const result = await emailChangeService.requestEmailChange(userId, parsed.data.newEmail);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/users/me/email/verify (B3)
   * Verifies OTP, updates email atomically, and revokes other sessions.
   */
  async verifyEmailChange(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = verifyEmailChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Invalid verification code.",
          "VALIDATION_ERROR"
        );
      }

      const result = await emailChangeService.verifyEmailChange(
        userId,
        parsed.data.code,
        req.sessionId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/users/me/deactivate (C1)
   * Deactivates authenticated user account and revokes all active sessions.
   */
  async deactivateAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = deactivateAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Current password is required.",
          "VALIDATION_ERROR"
        );
      }

      const result = await userService.deactivateAccount(userId, parsed.data.currentPassword);

      // Clear session cookies
      const cookieOptions = {
        httpOnly: true,
        secure: envConfig.NODE_ENV === "production",
        sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
        path: "/",
      };
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      res.clearCookie("pdf_session", cookieOptions);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/users/me (C4)
   * Permanently deletes authenticated user account and cascades dependent records.
   */
  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = deleteAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Current password is required.",
          "VALIDATION_ERROR"
        );
      }

      const result = await userService.deleteAccount(userId, parsed.data.currentPassword);

      // Clear session cookies
      const cookieOptions = {
        httpOnly: true,
        secure: envConfig.NODE_ENV === "production",
        sameSite: (envConfig.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
        path: "/",
      };
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
      res.clearCookie("pdf_session", cookieOptions);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/users/me/security-events (D4, D5, D6)
   * Retrieves paginated security activity events for the authenticated user.
   */
  async getSecurityEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.", "UNAUTHORIZED");
      }

      const parsed = getSecurityEventsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(
          parsed.error.issues[0]?.message || "Invalid query parameters.",
          "VALIDATION_ERROR"
        );
      }

      const result = await securityEventService.getUserEvents(userId, {
        limit: parsed.data.limit,
        ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();

