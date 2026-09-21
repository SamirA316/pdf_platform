export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 400, code: string = "BAD_REQUEST", details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", code: string = "BAD_REQUEST", details?: any) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required", code: string = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden", code: string = "FORBIDDEN") {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", code: string = "NOT_FOUND") {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict", code: string = "CONFLICT") {
    super(message, 409, code);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string = "File exceeds the allowed size.", code: string = "FILE_TOO_LARGE") {
    super(message, 400, code);
  }
}

// --- File Module Domain Errors ---

export class FileRequiredError extends AppError {
  constructor(message: string = "A file is required.", code: string = "FILE_REQUIRED") {
    super(message, 400, code);
  }
}

export class InvalidFileError extends AppError {
  constructor(message: string = "The provided file is invalid.", code: string = "INVALID_FILE") {
    super(message, 400, code);
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(message: string = "Only PDF files are supported.", code: string = "UNSUPPORTED_FORMAT") {
    super(message, 400, code);
  }
}

export class FileNotFoundError extends AppError {
  constructor(message: string = "File not found.", code: string = "FILE_NOT_FOUND") {
    super(message, 404, code);
  }
}

export class FileAccessDeniedError extends AppError {
  constructor(message: string = "Access to this file is denied.", code: string = "FILE_ACCESS_DENIED") {
    super(message, 403, code);
  }
}

export class FileUploadFailedError extends AppError {
  constructor(message: string = "File upload failed.", code: string = "FILE_UPLOAD_FAILED") {
    super(message, 500, code);
  }
}

export class FileDeleteFailedError extends AppError {
  constructor(message: string = "Failed to delete file.", code: string = "FILE_DELETE_FAILED") {
    super(message, 500, code);
  }
}

export class FileRenameInvalidError extends AppError {
  constructor(message: string = "Invalid file name provided.", code: string = "FILE_RENAME_INVALID") {
    super(message, 400, code);
  }
}

// --- Job Module Domain Errors ---

export class InvalidToolError extends AppError {
  constructor(message: string = "Invalid or unsupported PDF tool requested.", code: string = "INVALID_TOOL") {
    super(message, 400, code);
  }
}

export class JobNotFoundError extends AppError {
  constructor(message: string = "Job not found.", code: string = "JOB_NOT_FOUND") {
    super(message, 404, code);
  }
}

export class JobAccessDeniedError extends AppError {
  constructor(message: string = "Access to this job is denied.", code: string = "JOB_ACCESS_DENIED") {
    super(message, 403, code);
  }
}

export class InvalidJobStatusError extends AppError {
  constructor(message: string = "Invalid job status operation.", code: string = "INVALID_JOB_STATUS") {
    super(message, 400, code);
  }
}

export class InvalidInputFileError extends AppError {
  constructor(message: string = "Invalid input file for job processing.", code: string = "INVALID_INPUT_FILE") {
    super(message, 400, code);
  }
}

export class ProcessingFailedError extends AppError {
  constructor(message: string = "We couldn't process this PDF. Please try another file.", code: string = "PROCESSING_FAILED") {
    super(message, 500, code);
  }
}

export class JobCancelFailedError extends AppError {
  constructor(message: string = "Job cannot be cancelled in its current state.", code: string = "JOB_CANCEL_FAILED") {
    super(message, 400, code);
  }
}
