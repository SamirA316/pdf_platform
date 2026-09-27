import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../common/prisma";
import { logger } from "../../common/logger";
import {
  ICreateSessionResult,
  ISessionDto,
  IValidateSessionResult,
} from "./session.types";

export class SessionService {
  /**
   * Hashes raw session token with SHA-256 for secure database storage.
   * Plaintext session tokens are never saved to the database.
   */
  public hashSessionToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Generates a high-entropy 32-byte (64 hex characters) cryptographic session token.
   */
  public generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Create a new server-side session for an authenticated user.
   */
  async createSession(userId: string, ttlDays: number = 7): Promise<ICreateSessionResult> {
    const rawToken = this.generateSessionToken();
    const tokenHash = this.hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    logger.info(`Session created for user ${userId} (Session ID: ${session.id})`, "SESSION");

    return {
      session: {
        id: session.id,
        userId: session.userId,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        current: true,
        revoked: false,
      },
      rawToken,
    };
  }

  /**
   * Validates a session by raw token.
   * Checks expiration and revocation states.
   */
  async validateSession(rawToken: string): Promise<IValidateSessionResult> {
    if (!rawToken || typeof rawToken !== "string") {
      return { valid: false, reason: "NOT_FOUND" };
    }

    const tokenHash = this.hashSessionToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return { valid: false, reason: "NOT_FOUND" };
    }

    if (session.revokedAt !== null) {
      return { valid: false, reason: "REVOKED", sessionId: session.id, userId: session.userId };
    }

    if (new Date() > session.expiresAt) {
      return { valid: false, reason: "EXPIRED", sessionId: session.id, userId: session.userId };
    }

    if (!session.user || !session.user.isActive) {
      return { valid: false, reason: "REVOKED", sessionId: session.id, userId: session.userId };
    }

    // Update lastUsedAt in background
    prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        logger.warn(`Failed to update session lastUsedAt for ${session.id}`, "SESSION");
      });

    return {
      valid: true,
      userId: session.userId,
      sessionId: session.id,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        isVerified: session.user.isVerified,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
    };
  }

  /**
   * Revoke an active session using its raw token.
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = this.hashSessionToken(rawToken);

    const result = await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  /**
   * Revoke a specific session by its ID for an authenticated user.
   * Returns false if the session does not exist or does not belong to the user.
   * Idempotent if already revoked.
   */
  async revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      return false;
    }

    if (session.revokedAt !== null) {
      return true;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  /**
   * Revoke all OTHER active sessions for a user, preserving the specified current session.
   * Transaction-aware: supports an optional Prisma TransactionClient.
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    const result = await db.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    logger.info(`Revoked ${result.count} other sessions for user ${userId} (preserved session ${currentSessionId})`, "SESSION");
    return result.count;
  }

  /**
   * Revoke ALL active sessions for a user (e.g. on logout-all, password change/reset).
   * Transaction-aware: supports an optional Prisma TransactionClient.
   */
  async revokeAllUserSessions(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    const result = await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.info(`Revoked ${result.count} active sessions for user ${userId}`, "SESSION");
    return result.count;
  }

  /**
   * List all non-revoked active sessions for a user.
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
    currentRawToken?: string
  ): Promise<ISessionDto[]> {
    const currentTokenHash = currentRawToken ? this.hashSessionToken(currentRawToken) : null;

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => {
      const isCurrent = currentSessionId
        ? s.id === currentSessionId
        : currentTokenHash
        ? s.tokenHash === currentTokenHash
        : false;

      return {
        id: s.id,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
        current: isCurrent,
        revoked: false,
      };
    });
  }

  /**
   * Cleanup expired or revoked sessions older than retention days (default 30 days).
   */
  async cleanupExpiredSessions(retentionDays: number = 30): Promise<number> {
    const retentionDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: retentionDate } },
          { revokedAt: { lt: retentionDate } },
        ],
      },
    });

    logger.info(`Cleaned up ${result.count} expired/stale sessions`, "SESSION");
    return result.count;
  }
}

export const sessionService = new SessionService();
