import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import documentRoutes from "./routes/document.routes";
import pdfRoutes from "./routes/pdf.routes";
import path from "path";

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Serve uploads directory statically (optional, but good for direct links if needed later)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/pdf", pdfRoutes);

app.get("/", (req, res) => {
  res.send("PDF Platform API is running");
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
