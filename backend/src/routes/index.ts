import { Router } from "express";
import fs from "fs";
import path from "path";
import { sendSuccess } from "../common/responses/apiResponse";
import { NotFoundError } from "../common/errors/AppError";
import { prisma } from "../common/prisma";
import { storageService } from "../modules/files/storage.service";

import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import filesRoutes from "../modules/files/files.routes";
import jobsRoutes from "../modules/jobs/job.routes";
import pdfRoutes from "../modules/pdf/pdf.routes";
import editorRoutes from "../modules/editor/editor.routes";
import ocrRoutes from "../modules/ocr/ocr.routes";
import aiRoutes from "../modules/ai/ai.routes";
import usageRoutes from "../modules/usage/usage.routes";
import billingRoutes from "../modules/billing/billing.routes";
import documentRoutes from "./document.routes";

const v1Router = Router();

/**
 * Liveness probe endpoint
 * GET /api/v1/health
 */
v1Router.get("/health", (_req, res) => {
  sendSuccess(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe endpoint
 * GET /api/v1/ready
 * Verifies database responsiveness and storage filesystem writeability.
 */
v1Router.get("/ready", async (_req, res) => {
  try {
    // 1. Verify database connection
    await prisma.$queryRaw`SELECT 1`;

    // 2. Verify storage directory writeability
    const storageRoot = storageService.getStorageRoot();
    const testFile = path.join(storageRoot, `.readiness-${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);

    sendSuccess(res, {
      status: "ready",
      database: "connected",
      storage: "writable",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "unready",
      error: "Service dependencies not ready",
      timestamp: new Date().toISOString(),
    });
  }
});

// Mount modular sub-routers
v1Router.use("/auth", authRoutes);
v1Router.use("/users", userRoutes);
v1Router.use("/files", filesRoutes);
v1Router.use("/documents", documentRoutes);
v1Router.use("/jobs", jobsRoutes);
v1Router.use("/pdf", pdfRoutes);
v1Router.use("/editor", editorRoutes);
v1Router.use("/ocr", ocrRoutes);
v1Router.use("/ai", aiRoutes);
v1Router.use("/usage", usageRoutes);
v1Router.use("/billing", billingRoutes);

// Catch-all 404 for unrecognized v1 routes (including disabled admin routes)
v1Router.use((req, _res, next) => {
  next(new NotFoundError(`API v1 endpoint '${req.originalUrl}' not found.`));
});

export default v1Router;
