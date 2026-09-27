import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { prisma } from "../../common/prisma";
import { NotFoundError, UnauthorizedError } from "../../common/errors/AppError";
import { sessionService } from "../auth/session.service";
import { IPublicUser, IUpdateProfileInput, toPublicUser } from "./user.types";
import { securityEventService } from "./security-event.service";
import { storageService } from "../files/storage.service";
import { logger } from "../../common/logger";

export class UserService {
  /**
   * Retrieves the authenticated user's profile (A1).
   * Strictly returns sanitized public DTO without sensitive fields.
   */
  async getProfile(userId: string): Promise<IPublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    return toPublicUser(user);
  }

  /**
   * Updates the authenticated user's profile (A2).
   * A4: Explicitly assigns only allowed editable fields to prevent mass assignment.
   * A8: updatedAt is automatically updated via Prisma @updatedAt.
   */
  async updateProfile(userId: string, input: IUpdateProfileInput): Promise<IPublicUser> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundError("User not found.");
    }

    // Explicit field picking to prevent mass assignment vulnerabilities (A4)
    const { name } = input;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
      },
    });

    return toPublicUser(updated);
  }

  /**
   * Deactivates the authenticated user's account (C1).
   * - Verifies current password with bcrypt
   * - Sets isActive = false
   * - Revokes ALL active sessions (including current session) in a single transaction
   * - Records ACCOUNT_DEACTIVATED security event
   */
  async deactivateAccount(
    userId: string,
    currentPassword: string
  ): Promise<{ success: true; message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Current password is incorrect.", "INVALID_CREDENTIALS");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
        },
      });

      await sessionService.revokeAllUserSessions(userId, tx);
    });

    await securityEventService.record({
      userId,
      type: "ACCOUNT_DEACTIVATED",
    });

    return {
      success: true,
      message: "Account deactivated successfully.",
    };
  }

  /**
   * Permanently deletes the authenticated user's account and cascades all dependent records (C4, C5, C8).
   * - Verifies current password with bcrypt
   * - Collects File.storageKey and Document.path before DB deletion
   * - Deletes user record in database transaction, triggering ON DELETE CASCADE on all child relations
   * - Only after successful commit, performs best-effort physical storage cleanup (File + Document) safely
   */
  async deleteAccount(
    userId: string,
    currentPassword: string
  ): Promise<{ success: true; message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Current password is incorrect.", "INVALID_CREDENTIALS");
    }

    // Step 1: Collect file and document physical paths before DB deletion
    const [userFiles, userDocuments] = await Promise.all([
      prisma.file.findMany({
        where: { userId },
        select: { storageKey: true },
      }),
      prisma.document.findMany({
        where: { userId },
        select: { path: true },
      }),
    ]);

    // Step 2: Atomic DB deletion (Prisma ON DELETE CASCADE removes sessions, files, jobs, documents, email change requests)
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Step 3: Best-effort post-commit physical storage cleanup for both File and Document records
    const uploadBase = storageService.getStorageRoot();
    const workspaceBase = path.resolve(process.cwd());

    for (const file of userFiles) {
      if (file.storageKey) {
        try {
          const physicalPath = path.resolve(uploadBase, file.storageKey);
          const relativePath = path.relative(uploadBase, physicalPath);
          if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
            if (fs.existsSync(physicalPath)) {
              await fs.promises.unlink(physicalPath).catch(() => {
                logger.warn(
                  "Failed to clean up account file after deletion.",
                  "STORAGE"
                );
              });
            }
          }
        } catch {
          logger.warn(
            "Physical file cleanup failed during account deletion.",
            "STORAGE"
          );
        }
      }
    }

    for (const doc of userDocuments) {
      if (doc.path) {
        try {
          const physicalPath = path.isAbsolute(doc.path)
            ? path.resolve(doc.path)
            : path.resolve(uploadBase, doc.path);

          const relativeToUpload = path.relative(uploadBase, physicalPath);
          const relativeToCwd = path.relative(workspaceBase, physicalPath);

          // Ensure path is securely within uploads directory or workspace cwd (prevent path traversal)
          const isSafe =
            (!relativeToUpload.startsWith("..") && !path.isAbsolute(relativeToUpload)) ||
            (!relativeToCwd.startsWith("..") && !path.isAbsolute(relativeToCwd));

          if (isSafe && fs.existsSync(physicalPath)) {
            await fs.promises.unlink(physicalPath).catch(() => {
              logger.warn(
                "Failed to clean up account document after deletion.",
                "STORAGE"
              );
            });
          }
        } catch {
          logger.warn(
            "Physical document cleanup failed during account deletion.",
            "STORAGE"
          );
        }
      }
    }

    return {
      success: true,
      message: "Account permanently deleted.",
    };
  }
}

export const userService = new UserService();

