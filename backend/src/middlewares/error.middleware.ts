import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../common/errors/AppError";
import { sendError } from "../common/responses/apiResponse";

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Handled Operational Errors
  if (err instanceof AppError || (err && err.isOperational && err.code && err.statusCode)) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // 2. Multer Upload Errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      sendError(res, "FILE_TOO_LARGE", "File exceeds the allowed size.", 400);
      return;
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      sendError(res, "INVALID_FILE", `Unexpected field '${err.field || "unknown"}'. Upload file in field 'file'.`, 400);
      return;
    }
    sendError(res, "UPLOAD_ERROR", err.message, 400);
    return;
  }

  // 3. Body Parser JSON Syntax Errors
  if (err instanceof SyntaxError && "body" in err) {
    sendError(res, "INVALID_JSON", "Malformed JSON payload provided.", 400);
    return;
  }

  // 4. Custom validation error formatters
  if (err.message && err.message.startsWith("INVALID_EXTENSION")) {
    sendError(res, "INVALID_EXTENSION", err.message, 400);
    return;
  }
  if (err.message && err.message.startsWith("INVALID_MIME")) {
    sendError(res, "INVALID_MIME", err.message, 400);
    return;
  }

  // 5. Unhandled / Server Errors
  console.error("Unhandled Error:", err);
  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === "production"
    ? "An unexpected internal server error occurred."
    : err.message || "Internal server error";

  sendError(res, err.code || "INTERNAL_SERVER_ERROR", message, statusCode);
};
