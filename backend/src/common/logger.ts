/**
 * Structured Logger for QuickPDF Platform
 * Provides standardized INFO, WARN, ERROR, and DEBUG logging with sensitive data redaction.
 */

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "jwt",
  "secret",
  "otp",
  "apikey",
  "authorization",
  "cookie",
  "physicalpath",
  "storagekey",
  "filepath",
  "documentpath",
]);

/**
 * Recursively redacts sensitive keys from log metadata to prevent leaking credentials.
 */
function sanitizeMeta(meta: any): any {
  if (!meta || typeof meta !== "object") return meta;

  if (Array.isArray(meta)) {
    return meta.map(sanitizeMeta);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeMeta(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatMessage(level: LogLevel, message: string, context?: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? ` [${context}]` : "";
  const metaStr = meta ? ` ${JSON.stringify(sanitizeMeta(meta))}` : "";
  return `[${timestamp}] [${level}]${ctx}: ${message}${metaStr}`;
}

export const logger = {
  info(message: string, context?: string, meta?: any) {
    if (process.env.NODE_ENV === "test") return;
    console.log(formatMessage("INFO", message, context, meta));
  },

  warn(message: string, context?: string, meta?: any) {
    console.warn(formatMessage("WARN", message, context, meta));
  },

  error(message: string, context?: string, meta?: any) {
    console.error(formatMessage("ERROR", message, context, meta));
  },

  debug(message: string, context?: string, meta?: any) {
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return;
    console.debug(formatMessage("DEBUG", message, context, meta));
  },
};

export default logger;
