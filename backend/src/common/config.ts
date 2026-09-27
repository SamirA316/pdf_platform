import "dotenv/config";
import path from "path";

// Enforce mandatory JWT_SECRET at application startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  throw new Error("FATAL: JWT_SECRET environment variable is missing. Application refuses to start.");
}

if (process.env.NODE_ENV === "production") {
  if (process.env.JWT_SECRET === "super-secret-jwt-key-replace-in-production" || process.env.JWT_SECRET.length < 32) {
    throw new Error("FATAL: In production, JWT_SECRET must be a cryptographically secure key of at least 32 characters.");
  }

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    throw new Error("FATAL: In production, DATABASE_URL must be specified.");
  }

  if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.trim() === "") {
    throw new Error("FATAL: In production, FRONTEND_URL must be specified.");
  }

  // Enforce mandatory STORAGE_ROOT in production and validate that it is an absolute path
  if (!process.env.STORAGE_ROOT || process.env.STORAGE_ROOT.trim() === "") {
    throw new Error("FATAL: In production, STORAGE_ROOT environment variable is mandatory.");
  }
  if (!path.isAbsolute(process.env.STORAGE_ROOT.trim())) {
    throw new Error(
      `FATAL: In production, STORAGE_ROOT must be an absolute path (received: "${process.env.STORAGE_ROOT}").`
    );
  }

  // Enforce mandatory SMTP configuration in production (BLOCKER 2: No Ethereal fallback in production)
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.EMAIL_FROM ||
    process.env.SMTP_PASS === "your_app_password_here" ||
    process.env.SMTP_USER.trim() === "" ||
    process.env.SMTP_HOST.trim() === ""
  ) {
    throw new Error(
      "FATAL: SMTP configuration required in production (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM). Ethereal fallback is forbidden in production."
    );
  }

  // Enforce mandatory JOB_SECRETS_ENCRYPTION_KEY in production (Launch Blocker: durable encrypted passwords)
  if (!process.env.JOB_SECRETS_ENCRYPTION_KEY || process.env.JOB_SECRETS_ENCRYPTION_KEY.trim() === "") {
    throw new Error("FATAL: In production, JOB_SECRETS_ENCRYPTION_KEY environment variable is mandatory.");
  }
  const rawJobKey = process.env.JOB_SECRETS_ENCRYPTION_KEY.trim();
  const keyByteLen = /^[0-9a-fA-F]{64}$/.test(rawJobKey) ? 32 : Buffer.byteLength(rawJobKey, "utf8");
  if (keyByteLen < 32 || rawJobKey === "replace_with_a_secure_32_byte_hex_or_random_secret_string") {
    throw new Error(
      "FATAL: In production, JOB_SECRETS_ENCRYPTION_KEY must be at least 32 bytes (or 64 hex characters) and not a placeholder."
    );
  }
}

export const envConfig = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  JWT_SECRET: process.env.JWT_SECRET,
  JOB_SECRETS_ENCRYPTION_KEY: process.env.JOB_SECRETS_ENCRYPTION_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || "local",
  STORAGE_ROOT: process.env.STORAGE_ROOT || "",
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_BYTES || "52428800", 10),
  USER_STORAGE_QUOTA_BYTES: parseInt(process.env.USER_STORAGE_QUOTA_BYTES || "104857600", 10),
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || '"QuickPDF" <noreply@quickpdf.local>',
};
