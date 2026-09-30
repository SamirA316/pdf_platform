import crypto from "crypto";
import bcrypt from "bcrypt";
import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "../../common/prisma";
import { envConfig } from "../../common/config";
import { logger } from "../../common/logger";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  EmailDispatchError,
} from "../../common/errors/AppError";
import { sessionService } from "./session.service";
import { securityEventService } from "../users/security-event.service";
import { generateOtpEmailHtml } from "./email-templates";
import {
  IUserDto,
  IAuthResult,
  IRegisterResult,
  IOtpVerificationResult,
  IResendOtpResult,
  IForgotPasswordResult,
  IResetPasswordResult,
} from "./auth.types";
import {
  RegisterInput,
  LoginInput,
  VerifyOtpInput,
  ResendOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.validation";

export class AuthService {
  private transporter: Transporter | null = null;

  /**
   * Cryptographically secure HMAC-SHA256 hash for transient secrets (OTP, Reset Tokens).
   * Ensures plaintext secrets are never persisted in the database.
   */
  private hashSecret(secret: string): string {
    return crypto.createHmac("sha256", envConfig.JWT_SECRET).update(secret).digest("hex");
  }

  /**
   * Cryptographically secure 6-digit code generator using Node.js crypto.randomInt.
   */
  public generate6DigitCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Allows injecting a custom transporter or mock for testing.
   */
  public setMailTransporter(transporter: Transporter | null): void {
    this.transporter = transporter;
  }

  private toUserDto(user: {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): IUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private getMailTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const isSmtpConfigured = !!(
      envConfig.SMTP_USER &&
      envConfig.SMTP_PASS &&
      envConfig.SMTP_PASS !== "your_app_password_here"
    );

    if (isSmtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: envConfig.SMTP_HOST,
        port: envConfig.SMTP_PORT,
        secure: envConfig.SMTP_SECURE,
        auth: {
          user: envConfig.SMTP_USER,
          pass: envConfig.SMTP_PASS,
        },
      });
      logger.info("Transporter initialized with SMTP Server", "AUTH");
    } else {
      if (
        envConfig.NODE_ENV === "production" &&
        !process.env.RESEND_API_KEY &&
        process.env.ALLOW_OFFLINE_EMAIL_FALLBACK !== "true"
      ) {
        throw new Error("FATAL: SMTP configuration required in production. Ethereal fallback is forbidden in production.");
      }
      logger.info("Using ethereal fallback transporter in development", "AUTH");
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: {
          user: "ethereal@example.com",
          pass: "ethereal",
        },
      });
    }

    return this.transporter;
  }

  public async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    // 1. If RESEND_API_KEY is configured, send via Resend HTTPS REST API (Port 443 - never blocked by cloud firewalls)
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "") {
      try {
        const fromAddress = process.env.RESEND_FROM || "QuickPDF <onboarding@resend.dev>";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject,
            html,
            text,
          }),
        });

        if (res.ok) {
          logger.info(`Email successfully dispatched via Resend to ${to}`, "AUTH");
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          logger.error(`Resend API returned error: ${JSON.stringify(errData)}`, "AUTH");
        }
      } catch (err: any) {
        logger.error(`Resend fetch error: ${err?.message}`, "AUTH");
      }
    }

    // 2. Fallback to SMTP if configured with a 6-second timeout to prevent 2-minute hangs on blocked cloud ports
    const isSmtpConfigured = Boolean(
      envConfig.SMTP_USER &&
      envConfig.SMTP_PASS &&
      envConfig.SMTP_PASS !== "your_app_password_here"
    );

    if (isSmtpConfigured) {
      try {
        const mailer = this.getMailTransporter();
        await Promise.race([
          mailer.sendMail({
            from: envConfig.EMAIL_FROM,
            to,
            subject,
            html,
            text,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SMTP connection timed out (outbound port blocked by cloud provider)")), 6000)
          ),
        ]);
        logger.info(`Email successfully dispatched via SMTP to ${to}`, "AUTH");
        return;
      } catch (smtpErr: any) {
        logger.error(`Failed to dispatch email via SMTP to ${to}: ${smtpErr?.message}`, "AUTH");
      }
    }

    // 3. Fallback for cloud environments where outbound SMTP is restricted
    logger.warn(`=======================================================`, "AUTH");
    logger.warn(`[OTP NOTIFICATION FOR ${to}]`, "AUTH");
    logger.warn(`Subject: ${subject}`, "AUTH");
    logger.warn(`Content: ${text}`, "AUTH");
    logger.warn(`=======================================================`, "AUTH");

    if (process.env.ALLOW_OFFLINE_EMAIL_FALLBACK === "true" || envConfig.NODE_ENV !== "production") {
      logger.info(`ALLOW_OFFLINE_EMAIL_FALLBACK active: Continuing registration flow.`, "AUTH");
      return;
    }

    throw new EmailDispatchError(
      "Failed to send email (SMTP connection blocked by hosting provider). Please set ALLOW_OFFLINE_EMAIL_FALLBACK=true or add RESEND_API_KEY."
    );
  }

  /**
   * Register a new user account with hashed password and hashed OTP.
   */
  async register(input: RegisterInput): Promise<IRegisterResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });

    if (existing && existing.isVerified) {
      throw new ConflictError("Email is already registered. Please log in.");
    }

    if (existing && !existing.isVerified) {
      // 60-second cooldown check to protect unverified accounts against repeated OTP spam
      if (existing.otpLastSentAt) {
        const elapsedSeconds = Math.floor((Date.now() - existing.otpLastSentAt.getTime()) / 1000);
        if (elapsedSeconds < 60) {
          const remainingCooldown = 60 - elapsedSeconds;
          throw new BadRequestError(
            `A verification code was recently sent. Please wait ${remainingCooldown} seconds before requesting another code.`
          );
        }
      }
    }

    const rawOtp = this.generate6DigitCode();
    const hashedOtp = this.hashSecret(rawOtp);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedPassword = await bcrypt.hash(input.password, 12);

    let user;
    const isNewUser = !existing;
    if (existing && !existing.isVerified) {
      // User exists but has not verified their email yet: refresh OTP and credentials
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          password: hashedPassword,
          otp: hashedOtp,
          otpExpires,
          otpAttempts: 0,
          otpLastSentAt: new Date(),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          otp: hashedOtp,
          otpExpires,
          otpAttempts: 0,
          otpLastSentAt: new Date(),
          isVerified: false,
        },
      });
    }

    logger.info(`Verification OTP generated and dispatched to ${input.email}`, "AUTH");

    try {
      await this.sendEmail(
        input.email,
        "Verify your QuickPDF Account",
        generateOtpEmailHtml({
          title: "Verify Your Email Address",
          subtitle: "Thank you for creating an account with QuickPDF. Use the 6-digit code below to complete your registration.",
          code: rawOtp,
          expireMinutes: 10,
        }),
        `Your QuickPDF verification code is: ${rawOtp}. It expires in 10 minutes.`
      );
    } catch (emailErr) {
      // Transactional cleanup if email dispatch fails
      if (isNewUser) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { otpLastSentAt: existing?.otpLastSentAt },
        }).catch(() => {});
      }
      throw emailErr;
    }

    return {
      userId: user.id,
      email: user.email,
      message: "Verification code sent to your email.",
    };
  }

  /**
   * Verify email using 6-digit OTP with brute-force attempt limits.
   */
  async verifyOtp(input: VerifyOtpInput): Promise<IOtpVerificationResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new BadRequestError("Invalid email or verification code.");
    }

    if (user.isVerified) {
      const { rawToken } = await sessionService.createSession(user.id);
      return {
        user: this.toUserDto(user),
        token: rawToken,
        message: "Email is already verified.",
      };
    }

    if (!user.otp || !user.otpExpires) {
      throw new BadRequestError("No active verification code found. Please request a new one.");
    }

    if (new Date() > user.otpExpires) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpires: null, otpAttempts: 0 },
      });
      throw new BadRequestError("Verification code has expired. Please request a new code.");
    }

    // Maximum 5 incorrect attempts before invalidating OTP
    if (user.otpAttempts >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpires: null, otpAttempts: 0 },
      });
      throw new BadRequestError(
        "Too many incorrect attempts. This verification code has been invalidated. Please request a new code."
      );
    }

    const hashedInputOtp = this.hashSecret(input.otp);
    if (hashedInputOtp !== user.otp) {
      // Atomically increment attempts to prevent race conditions from concurrent requests
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });

      const remaining = Math.max(0, 5 - updatedUser.otpAttempts);
      if (remaining === 0 || updatedUser.otpAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { otp: null, otpExpires: null, otpAttempts: 0 },
        });
        throw new BadRequestError(
          "Too many incorrect attempts. This verification code has been invalidated. Please request a new code."
        );
      }

      throw new BadRequestError(`Invalid verification code. ${remaining} attempts remaining.`);
    }

    // Success: Mark as verified and invalidate OTP
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpires: null,
        otpAttempts: 0,
      },
    });

    const { rawToken } = await sessionService.createSession(updated.id);
    return {
      user: this.toUserDto(updated),
      token: rawToken,
      message: "Email successfully verified.",
    };
  }

  /**
   * Resend verification code with a mandatory 60-second cooldown.
   */
  async resendOtp(input: ResendOtpInput): Promise<IResendOtpResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new NotFoundError("No account found with this email address.");
    }

    if (user.isVerified) {
      throw new BadRequestError("This account is already verified. Please log in.");
    }

    // Enforce 60-second cooldown between resend requests
    if (user.otpLastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - user.otpLastSentAt.getTime()) / 1000);
      if (elapsedSeconds < 60) {
        const remainingCooldown = 60 - elapsedSeconds;
        throw new BadRequestError(
          `Please wait ${remainingCooldown} seconds before requesting another code.`
        );
      }
    }

    const prevLastSentAt = user.otpLastSentAt;
    const rawOtp = this.generate6DigitCode();
    const hashedOtp = this.hashSecret(rawOtp);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp: hashedOtp,
        otpExpires,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      },
    });

    logger.info(`Verification OTP regenerated and dispatched to ${input.email}`, "AUTH");

    try {
      await this.sendEmail(
        input.email,
        "New Verification Code - QuickPDF",
        generateOtpEmailHtml({
          title: "Your New Verification Code",
          subtitle: "You requested a new verification code for your QuickPDF account. Enter this code to verify your account.",
          code: rawOtp,
          expireMinutes: 10,
        }),
        `Your new QuickPDF verification code is: ${rawOtp}. It expires in 10 minutes.`
      );
    } catch (emailErr) {
      // Revert otpLastSentAt if email dispatch fails so user isn't locked out by cooldown
      await prisma.user.update({
        where: { id: user.id },
        data: { otpLastSentAt: prevLastSentAt },
      }).catch(() => {});
      throw emailErr;
    }

    return {
      message: "New verification code sent to your email.",
      cooldownSeconds: 60,
    };
  }

  /**
   * Authenticate user with email & password and create a secure session.
   */
  async login(input: LoginInput): Promise<IAuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      await securityEventService.record({
        userId: user.id,
        type: "LOGIN_FAILED",
      });
      throw new UnauthorizedError("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is unavailable.", "ACCOUNT_DEACTIVATED");
    }

    if (!user.isVerified) {
      throw new UnauthorizedError(
        "Please verify your email address before logging in.",
        "UNVERIFIED_EMAIL"
      );
    }

    const { rawToken } = await sessionService.createSession(user.id);

    await securityEventService.record({
      userId: user.id,
      type: "LOGIN_SUCCESS",
    });

    return {
      user: this.toUserDto(user),
      token: rawToken,
    };
  }

  /**
   * Retrieve current user profile by user ID.
   */
  async getProfile(userId: string): Promise<IUserDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError("User account not found.");
    }

    return this.toUserDto(user);
  }

  /**
   * Request password reset code (prevents email enumeration).
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<IForgotPasswordResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // If user does not exist or is unverified, return generic success to avoid enumeration
    if (!user || !user.isVerified) {
      return {
        message: "If an account exists with this email, a password reset code has been sent.",
      };
    }

    const rawResetCode = this.generate6DigitCode();
    const hashedResetCode = this.hashSecret(rawResetCode);
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedResetCode,
        resetPasswordExpires,
        resetPasswordAttempts: 0,
      },
    });

    logger.info(`Password reset code generated and dispatched to ${input.email}`, "AUTH");

    try {
      await this.sendEmail(
        input.email,
        "Password Reset Request - QuickPDF",
        generateOtpEmailHtml({
          title: "Reset Your Password",
          subtitle: "We received a request to reset your QuickPDF account password. Use the verification code below to proceed.",
          code: rawResetCode,
          expireMinutes: 15,
        }),
        `Your QuickPDF password reset code is: ${rawResetCode}. It expires in 15 minutes.`
      );
    } catch (emailErr) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
          resetPasswordAttempts: 0,
        },
      }).catch(() => {});
      throw emailErr;
    }

    return {
      message: "If an account exists with this email, a password reset code has been sent.",
    };
  }

  /**
   * Reset password using reset token / code with brute-force attempt limits.
   */
  async resetPassword(input: ResetPasswordInput): Promise<IResetPasswordResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new BadRequestError("Invalid or expired password reset request.");
    }

    if (new Date() > user.resetPasswordExpires) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
          resetPasswordAttempts: 0,
        },
      });
      throw new BadRequestError("Password reset code has expired. Please request a new one.");
    }

    // Maximum 5 incorrect attempts before invalidating reset token
    if (user.resetPasswordAttempts >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
          resetPasswordAttempts: 0,
        },
      });
      throw new BadRequestError(
        "Too many incorrect attempts. This password reset code has been invalidated. Please request a new code."
      );
    }

    const hashedInput = this.hashSecret(input.token);
    if (hashedInput !== user.resetPasswordToken) {
      // Atomically increment reset attempts to prevent race conditions
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordAttempts: { increment: 1 } },
      });

      const remaining = Math.max(0, 5 - updatedUser.resetPasswordAttempts);
      if (remaining === 0 || updatedUser.resetPasswordAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            resetPasswordToken: null,
            resetPasswordExpires: null,
            resetPasswordAttempts: 0,
          },
        });
        throw new BadRequestError(
          "Too many incorrect attempts. This password reset code has been invalidated. Please request a new code."
        );
      }

      throw new BadRequestError(`Invalid password reset code. ${remaining} attempts remaining.`);
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          resetPasswordAttempts: 0,
        },
      });

      // Invalidate all existing sessions upon password reset atomically
      await sessionService.revokeAllUserSessions(user.id, tx);
    });

    await securityEventService.record({
      userId: user.id,
      type: "PASSWORD_RESET",
    });

    return {
      message: "Password has been successfully reset. You can now log in.",
    };
  }

  /**
   * Change password for authenticated user (Phase 2.4B).
   * Verifies current password, hashes new password with bcrypt, and revokes all OTHER sessions.
   * Strictly executes both in a single atomic Prisma transaction.
   * Strictly preserves the current active session.
   */
  async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    input: ChangePasswordInput
  ): Promise<{ message: string; revokedOtherSessionsCount: number }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError("User account not found.", "UNAUTHORIZED");
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Current password is incorrect.", "INVALID_CREDENTIALS");
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    let revokedCount = 0;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      if (currentSessionId) {
        revokedCount = await sessionService.revokeAllOtherSessions(user.id, currentSessionId, tx);
      } else {
        revokedCount = await sessionService.revokeAllUserSessions(user.id, tx);
      }
    });

    await securityEventService.record({
      userId: user.id,
      type: "PASSWORD_CHANGED",
    });

    return {
      message: "Password changed successfully. All other sessions have been logged out.",
      revokedOtherSessionsCount: revokedCount,
    };
  }
}

export const authService = new AuthService();
