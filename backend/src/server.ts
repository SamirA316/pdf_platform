import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import documentRoutes from "./routes/document.routes";
import pdfRoutes from "./routes/pdf.routes";
import v1Router from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());

// NOTE [Security Remediation - Phase 0]:
// Public static access to /uploads has been removed to prevent unauthorized file enumeration/access.
// Documents must be accessed through authenticated endpoints (/api/documents/download/:id).
// app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- API v1 Modular Architecture (Phase 1) ---
app.use("/api/v1", v1Router);

// LEGACY API
// Temporary backward compatibility only.
// New functionality MUST use /api/v1.
// These routes will be migrated module-by-module.
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/pdf", pdfRoutes);

app.get("/", (req, res) => {
  res.send("PDF Platform API is running");
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export { app };
export default app;
