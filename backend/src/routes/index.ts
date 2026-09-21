import { Router } from "express";
import { sendSuccess } from "../common/responses/apiResponse";
import { NotFoundError } from "../common/errors/AppError";

import authRoutes from "../modules/auth/auth.routes";
import filesRoutes from "../modules/files/files.routes";
import jobsRoutes from "../modules/jobs/jobs.routes";
import pdfRoutes from "../modules/pdf/pdf.routes";
import editorRoutes from "../modules/editor/editor.routes";
import ocrRoutes from "../modules/ocr/ocr.routes";
import aiRoutes from "../modules/ai/ai.routes";
import usageRoutes from "../modules/usage/usage.routes";
import billingRoutes from "../modules/billing/billing.routes";
import adminRoutes from "../modules/admin/admin.routes";

const v1Router = Router();

/**
 * Health check endpoint
 * GET /api/v1/health
 */
v1Router.get("/health", (req, res) => {
  sendSuccess(res, {
    status: "ok",
  });
});

// Mount modular sub-routers
v1Router.use("/auth", authRoutes);
v1Router.use("/files", filesRoutes);
v1Router.use("/jobs", jobsRoutes);
v1Router.use("/pdf", pdfRoutes);
v1Router.use("/editor", editorRoutes);
v1Router.use("/ocr", ocrRoutes);
v1Router.use("/ai", aiRoutes);
v1Router.use("/usage", usageRoutes);
v1Router.use("/billing", billingRoutes);
v1Router.use("/admin", adminRoutes);

// Catch-all 404 for unrecognized v1 routes
v1Router.use((req, res, next) => {
  next(new NotFoundError(`API v1 endpoint '${req.originalUrl}' not found.`));
});

export default v1Router;
