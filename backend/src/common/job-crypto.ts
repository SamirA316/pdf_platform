import crypto from "crypto";
import { logger } from "./logger";

/**
 * Returns a 32-byte cryptographic key buffer for AES-256-GCM encryption.
 */
function getJobSecretsKey(): Buffer {
  const rawKey = process.env.JOB_SECRETS_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: In production, JOB_SECRETS_ENCRYPTION_KEY is mandatory.");
    }
    // Deterministic dev/test key (32 bytes)
    return crypto.createHash("sha256").update("quickpdf-dev-job-secrets-fallback-key-2026").digest();
  }

  // If 64 hex characters, parse directly as 32-byte hex buffer
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // Otherwise derive a 32-byte key via SHA-256
  return crypto.createHash("sha256").update(rawKey, "utf8").digest();
}

/**
 * Encrypts sensitive job options (e.g. passwords) using AES-256-GCM.
 * Returns formatted string: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function encryptJobSecrets(secrets: Record<string, any>): string {
  if (!secrets || typeof secrets !== "object" || Object.keys(secrets).length === 0) {
    throw new Error("Cannot encrypt empty secrets payload.");
  }

  const key = getJobSecretsKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const jsonString = JSON.stringify(secrets);
  const ciphertext = Buffer.concat([cipher.update(jsonString, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts sensitive job options from `${ivHex}:${authTagHex}:${ciphertextHex}` using AES-256-GCM.
 * Authenticates the GCM authentication tag to prevent tampering.
 */
export function decryptJobSecrets(encryptedPayload: string | null | undefined): Record<string, any> {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    return {};
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    logger.error("Malformed encrypted job secrets payload format.", "CRYPTO");
    throw new Error("Malformed encrypted secrets format.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

  try {
    const key = getJobSecretsKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (err: any) {
    logger.error("Failed to decrypt job secret options (tag mismatch or corrupted data).", "CRYPTO");
    throw new Error("Decryption failed for job secrets.");
  }
}
