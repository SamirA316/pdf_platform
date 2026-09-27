import { prisma } from "../../common/prisma";
import { logger } from "../../common/logger";
import {
  IRecordSecurityEventParams,
  ISecurityEventPublic,
  IGetSecurityEventsOptions,
  IGetSecurityEventsResult,
} from "./security-event.types";

export class SecurityEventService {
  /**
   * Records a security event for an authenticated user (D2).
   * Best-effort execution: Business flow remains primary, logging failure logs a warning/error
   * but never crashes the calling flow.
   */
  async record(params: IRecordSecurityEventParams): Promise<void> {
    try {
      if (!params.userId || !params.type) {
        return;
      }

      await prisma.securityEvent.create({
        data: {
          userId: params.userId,
          type: params.type,
        },
      });

      logger.info(
        `Security event recorded for user ${params.userId}: ${params.type}`,
        "SECURITY_EVENT"
      );
    } catch (err) {
      logger.error(
        `Failed to record security event [${params.type}] for user [${params.userId}]: ${err}`,
        "SECURITY_EVENT"
      );
    }
  }

  /**
   * Retrieves security activity events for the authenticated user (D4, D5, D6).
   * Strictly enforces user isolation (D6) and privacy (D8) with cursor-based pagination.
   */
  async getUserEvents(
    userId: string,
    options: IGetSecurityEventsOptions = {}
  ): Promise<IGetSecurityEventsResult> {
    const rawLimit = options.limit ?? 20;
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const { cursor } = options;

    const events = await prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        type: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    if (events.length > limit) {
      events.pop();
      nextCursor = events[events.length - 1]?.id;
    }

    return {
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
      })),
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  /**
   * Cleanup retention method for purging security events older than retention days (default 90 days) (D7).
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
      throw new Error("retentionDays must be a positive integer");
    }
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.securityEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info(`Cleaned up ${result.count} security events older than ${retentionDays} days`, "SECURITY_EVENT");
    return result.count;
  }
}

export const securityEventService = new SecurityEventService();
