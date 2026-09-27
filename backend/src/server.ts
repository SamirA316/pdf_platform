import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import documentRoutes from "./routes/document.routes";
import pdfRoutes from "./routes/pdf.routes";
import v1Router from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import { csrfProtection } from "./middlewares/csrf.middleware";
import { logger } from "./common/logger";
import { jobWorker } from "./workers/job.worker";

const app = express();

// C8 — Security Headers Configuration
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "sameorigin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(morgan("dev"));

// Controlled JSON and form payload limit (prevents memory exhaustion; large files stream via Multer)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// C1 — CSRF Protection Middleware (Double-submit token + Origin verification)
app.use(csrfProtection);

// Global API rate limiter
app.use("/api/", apiLimiter);

// --- API v1 Architecture ---
app.use("/api/v1", v1Router);

// --- LEGACY ROUTES (DEPRECATED) ---
// In production, legacy routes are strictly disabled to enforce /api/v1/* architecture.
if (process.env.NODE_ENV !== "production") {
  app.use(
    "/api/documents",
    (req, res, next) => {
      res.setHeader(
        "X-API-Deprecated",
        "Legacy document routes are deprecated. Migrate to /api/v1/files/"
      );
      next();
    },
    documentRoutes
  );

  app.use(
    "/api/pdf",
    (req, res, next) => {
      res.setHeader(
        "X-API-Deprecated",
        "Legacy PDF routes are deprecated. Migrate to /api/v1/jobs/ and /api/v1/editor/"
      );
      next();
    },
    pdfRoutes
  );
} else {
  app.use(["/api/documents", "/api/pdf"], (_req, res) => {
    res.status(404).json({
      error: "ENDPOINT_REMOVED",
      message: "Legacy endpoints are permanently disabled in production. All clients must use /api/v1/* APIs.",
    });
  });
}

app.get("/", (req, res) => {
  res.send("PDF Platform API is running");
});

// Centralized Error Handling Middleware (C7: with DB error sanitization)
app.use(errorMiddleware);

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`, "SERVER");
    jobWorker.start();
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server and stopping job worker...`, "SERVER");
    server.close(async () => {
      await jobWorker.stop();
      logger.info("HTTP server closed and worker stopped.", "SERVER");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export { app };
export default app;
