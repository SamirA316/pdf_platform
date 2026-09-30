import crypto from "crypto";
import { prisma } from "../../common/prisma";
import { envConfig } from "../../common/config";
import { logger } from "../../common/logger";
import { authService } from "../auth/auth.service";
import { generateOtpEmailHtml } from "../auth/email-templates";
import { BadRequestError, NotFoundError } from "../../common/errors/AppError";
import { IPublicUser, toPublicUser } from "./user.types";
import { securityEventService } from "./security-event.service";

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function safeTokenMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class EmailChangeService {
  /**
   * Cryptographically secure HMAC-SHA256 hash for transient OTP secrets.
   * Ensures plaintext OTPs are never stored in the database.
   */
  public hashSecret(secret: string): string {
    return crypto.createHmac("sha256", envConfig.JWT_SECRET).update(secret).digest("hex");
  }

  /**
   * Generates a 6-digit cryptographically random OTP.
   */
  public generate6DigitCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * B1 — Request Email Change
   * Validates format, availability, cooldown, and generates/stores hashed OTP.
   */
  async requestEmailChange(
    userId: string,
    newEmail: string
  ): Promise<{ success: true; message: string }> {
    const normalizedEmail = newEmail.toLowerCase().trim();

    // 1. Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // 2. Reject if new email is identical to current email
    if (user.email.toLowerCase().trim() === normalizedEmail) {
      throw new BadRequestError(
        "New email must be different from current email.",
        "SAME_EMAIL"
      );
    }

    // 3. Reject if new email is already associated with another account (B6 / B9 / B11)
    const existingOther = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingOther && existingOther.id !== userId) {
      throw new BadRequestError(
        "This email cannot be used. Please choose a different email.",
        "EMAIL_UNAVAILABLE"
      );
    }

    // 4. Enforce 60-second resend cooldown on pending requests (B1 / B7)
    const pending = await prisma.emailChangeRequest.findFirst({
      where: {
        userId,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (pending && pending.lastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - pending.lastSentAt.getTime()) / 1000);
      if (elapsedSeconds < 60) {
        const remaining = 60 - elapsedSeconds;
        throw new BadRequestError(
          `Please wait ${remaining} seconds before requesting a new verification code.`,
          "RESEND_COOLDOWN_ACTIVE"
        );
      }
    }

    // 5. Invalidate previous pending unverified requests for this user
    await prisma.emailChangeRequest.deleteMany({
      where: {
        userId,
        verifiedAt: null,
      },
    });

    // 6. Generate secure 6-digit OTP & store only its HMAC-SHA256 hash (B2 / B7)
    const rawOtp = this.generate6DigitCode();
    const otpHash = this.hashSecret(rawOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry

    await prisma.emailChangeRequest.create({
      data: {
        userId,
        newEmail: normalizedEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    // 7. Dispatch OTP to the NEW email address (B1)
    logger.info(`Email change verification OTP dispatched to ${normalizedEmail}`, "AUTH");

    await authService.sendEmail(
      normalizedEmail,
      "Verify Your New Email Address - QuickPDF Platform",
      generateOtpEmailHtml({
        title: "Verify New Email Address",
        subtitle: `You requested to update your QuickPDF Platform account email to <strong>${normalizedEmail}</strong>. Enter the verification code below to confirm this change.`,
        code: rawOtp,
        expireMinutes: 10,
      }),
      `Your QuickPDF Platform email change verification code is: ${rawOtp}. Valid for 10 minutes.`
    );

    await securityEventService.record({
      userId,
      type: "EMAIL_CHANGE_REQUESTED",
    });

    return {
      success: true,
      message: "Verification code sent.",
    };
  }

  /**
   * B3 & B4 & B5 — Verify New Email and Commit Atomic Update
   * Inside single transaction:
   * - Atomically consumes EmailChangeRequest (verifiedAt, otpHash = 'CONSUMED') with concurrency guards
   * - Validates email availability & updates User.email
   * - Revokes all other sessions, keeping current session active
   */
  async verifyEmailChange(
    userId: string,
    code: string,
    currentSessionId?: string
  ): Promise<{ success: true; message: string; user: IPublicUser }> {
    // 1. Locate active pending request for user
    const pending = await prisma.emailChangeRequest.findFirst({
      where: {
        userId,
        verifiedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pending) {
      throw new BadRequestError(
        "No pending email change request found.",
        "NO_PENDING_REQUEST"
      );
    }

    // 2. Check attempt limit first (max 5 failed attempts)
    if (pending.attempts >= 5) {
      throw new BadRequestError(
        "Too many incorrect attempts. This email change request has been invalidated. Please request a new code.",
        "TOO_MANY_ATTEMPTS"
      );
    }

    // 3. Check if request has expired
    if (pending.expiresAt < new Date()) {
      throw new BadRequestError(
        "Verification code has expired. Please request a new code.",
        "CODE_EXPIRED"
      );
    }

    // 4. Secure timing-safe hash comparison
    const incomingHash = this.hashSecret(code);
    const isMatch = safeTokenMatch(incomingHash, pending.otpHash);

    if (!isMatch) {
      // Race-safe atomic increment: only increment if attempts < 5 and request is still unverified
      const updateResult = await prisma.emailChangeRequest.updateMany({
        where: {
          id: pending.id,
          verifiedAt: null,
          attempts: { lt: 5 },
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        // Attempt limit was already reached concurrently or request was already consumed
        throw new BadRequestError(
          "Too many incorrect attempts. This email change request has been invalidated. Please request a new code.",
          "TOO_MANY_ATTEMPTS"
        );
      }

      // Read current attempts to provide accurate remaining attempts
      const current = await prisma.emailChangeRequest.findUnique({
        where: { id: pending.id },
      });
      const currentAttempts = current ? current.attempts : 5;
      const remainingAttempts = Math.max(0, 5 - currentAttempts);

      if (remainingAttempts === 0) {
        await prisma.emailChangeRequest.updateMany({
          where: { id: pending.id },
          data: { expiresAt: new Date(0) },
        });
        throw new BadRequestError(
          "Too many incorrect attempts. This email change request has been invalidated. Please request a new code.",
          "TOO_MANY_ATTEMPTS"
        );
      }

      throw new BadRequestError(
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
        "INVALID_CODE"
      );
    }

    // 5. Atomic Transaction (B4): Atomic OTP consumption + User.email update + Session revocation (B5)
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Step A: Atomically consume the pending request if and only if it is still unverified, unexpired, and attempts < 5
      const consumed = await tx.emailChangeRequest.updateMany({
        where: {
          id: pending.id,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        data: {
          verifiedAt: new Date(),
          otpHash: "CONSUMED",
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestError(
          "Verification code is invalid or has already been used.",
          "INVALID_CODE"
        );
      }

      // Step B: Concurrency check: Ensure new email is still available
      const existingOwner = await tx.user.findUnique({
        where: { email: pending.newEmail },
      });
      if (existingOwner && existingOwner.id !== userId) {
        throw new BadRequestError(
          "This email is already in use by another account.",
          "EMAIL_ALREADY_IN_USE"
        );
      }

      // Step C: Update user's email
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          email: pending.newEmail,
        },
      });

      // Step D: Revoke all other sessions for this user, keeping current active (B5)
      const sessionWhere: any = {
        userId,
        revokedAt: null,
      };
      if (currentSessionId) {
        sessionWhere.id = { not: currentSessionId };
      }

      await tx.session.updateMany({
        where: sessionWhere,
        data: {
          revokedAt: new Date(),
        },
      });

      return user;
    });

    logger.info(
      `Email updated successfully for user ${userId} to ${pending.newEmail}`,
      "USER"
    );

    await securityEventService.record({
      userId,
      type: "EMAIL_CHANGED",
    });

    return {
      success: true,
      message: "Email changed successfully.",
      user: toPublicUser(updatedUser),
    };
  }
}

export const emailChangeService = new EmailChangeService();
