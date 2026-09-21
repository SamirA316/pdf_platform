import path from "path";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../common/prisma";
import { ALLOWED_TOOLS, ALLOWED_COMPRESS_LEVELS, ALLOWED_SPLIT_MODES, ALLOWED_ROTATION_ANGLES, JobStatus } from "./job.constants";
import { ICreateJobDto } from "./job.types";
import {
  InvalidToolError,
  InvalidInputFileError,
  InvalidJobStatusError,
  BadRequestError,
} from "../../common/errors/AppError";

/**
 * Validates job creation payload and verifies input file ownership & status.
 */
export async function validateCreateJob(userId: string, data: ICreateJobDto): Promise<{
  validatedTool: string;
  validatedInputFileIds: string[];
  validatedOptions: Record<string, any>;
}> {
  // 1. Tool Whitelist Validation
  if (!data.tool || typeof data.tool !== "string") {
    throw new InvalidToolError("A valid 'tool' string must be provided.");
  }

  const normalizedTool = data.tool.trim().toLowerCase();
  if (!ALLOWED_TOOLS.has(normalizedTool)) {
    throw new InvalidToolError(
      `Tool '${data.tool}' is not recognized or unsupported. Allowed: ${Array.from(ALLOWED_TOOLS).join(", ")}`
    );
  }

  // 2. Input File IDs Array Validation
  if (!data.inputFileIds || !Array.isArray(data.inputFileIds) || data.inputFileIds.length === 0) {
    throw new InvalidInputFileError("At least one input file ID must be provided in 'inputFileIds'.");
  }

  const fileIds = data.inputFileIds.map((id) => String(id).trim()).filter(Boolean);
  if (fileIds.length === 0) {
    throw new InvalidInputFileError("Invalid or empty input file IDs provided.");
  }

  // Tool-specific input file count constraints
  if (normalizedTool === "compress-pdf" && fileIds.length > 1) {
    throw new InvalidInputFileError("Tool 'compress-pdf' accepts exactly 1 input file.");
  }

  if (normalizedTool === "merge-pdf") {
    if (fileIds.length < 2) {
      throw new InvalidInputFileError("Tool 'merge-pdf' requires at least 2 input files.");
    }
    if (new Set(fileIds).size !== fileIds.length) {
      throw new InvalidInputFileError("Duplicate input file IDs are not permitted.");
    }
  }

  if (normalizedTool === "split-pdf" && fileIds.length !== 1) {
    throw new InvalidInputFileError("Tool 'split-pdf' accepts exactly 1 input file.");
  }

  // 3. Database Ownership & Status Verification
  const files = await prisma.file.findMany({
    where: {
      id: { in: fileIds },
      userId,
    },
  });

  if (files.length !== fileIds.length) {
    throw new InvalidInputFileError("One or more input files do not exist or are not owned by the authenticated user.");
  }

  for (const file of files) {
    if (file.status !== "READY") {
      throw new InvalidInputFileError(
        `Input file '${file.originalName}' is not in READY status (current status: ${file.status}).`
      );
    }
    if (file.mimeType !== "application/pdf") {
      throw new InvalidInputFileError(
        `Input file '${file.originalName}' is not a valid PDF document (mimeType: ${file.mimeType}).`
      );
    }
  }

  // 4. Tool-Specific Options Validation
  const options = data.options && typeof data.options === "object" ? { ...data.options } : {};
  if (normalizedTool === "compress-pdf") {
    const level = options.level ? String(options.level).toLowerCase() : "recommended";
    if (!ALLOWED_COMPRESS_LEVELS.has(level)) {
      throw new BadRequestError(
        `Invalid compression level '${options.level}'. Allowed levels: ${Array.from(ALLOWED_COMPRESS_LEVELS).join(", ")}`,
        "INVALID_TOOL_OPTIONS"
      );
    }
    options.level = level;
  }

  if (normalizedTool === "split-pdf") {
    const mode = options.mode ? String(options.mode).toLowerCase() : "";
    if (!ALLOWED_SPLIT_MODES.has(mode)) {
      throw new BadRequestError(
        `Invalid split mode '${options.mode}'. Allowed modes: ${Array.from(ALLOWED_SPLIT_MODES).join(", ")}`,
        "INVALID_TOOL_OPTIONS"
      );
    }
    options.mode = mode;

    // Resolve physical file to verify page count against ranges / pages
    const inputFile = files[0]!;
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, inputFile.storageKey);
    if (!fs.existsSync(physicalPath)) {
      throw new InvalidInputFileError("Physical input PDF does not exist on disk.");
    }

    let totalPages = 0;
    try {
      const pdfBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
    } catch {
      throw new BadRequestError("Unable to read input PDF document.", "INVALID_PDF");
    }

    if (totalPages < 1) {
      throw new BadRequestError("The PDF document contains no pages.", "INVALID_PDF_PAGES");
    }

    if (mode === "ranges") {
      if (!Array.isArray(options.ranges) || options.ranges.length === 0) {
        throw new BadRequestError("At least one page range must be provided.", "NO_RANGES_SELECTED");
      }
      if (options.ranges.length > 100) {
        throw new BadRequestError("Split operation cannot produce more than 100 output files at once.", "MAX_OUTPUTS_EXCEEDED");
      }

      for (let i = 0; i < options.ranges.length; i++) {
        const r = options.ranges[i];
        if (!r || typeof r !== "object") {
          throw new BadRequestError(`Invalid range object at index ${i}.`, "INVALID_PAGE_RANGE");
        }
        const start = Number(r.start);
        const end = Number(r.end);

        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          throw new BadRequestError("Page ranges must have valid integer start and end values.", "INVALID_PAGE_RANGE");
        }
        if (start < 1) {
          throw new BadRequestError(`Page range start must be >= 1 (got ${start}).`, "INVALID_PAGE_RANGE");
        }
        if (end < start) {
          throw new BadRequestError(`Page range end (${end}) cannot be less than start (${start}).`, "INVALID_PAGE_RANGE");
        }
        if (end > totalPages) {
          throw new BadRequestError(
            `Page range end (${end}) exceeds total document pages (${totalPages}).`,
            "PAGE_OUT_OF_BOUNDS"
          );
        }
      }

      // Check for overlapping ranges
      const sortedRanges = [...options.ranges].sort((a, b) => Number(a.start) - Number(b.start));
      for (let i = 0; i < sortedRanges.length - 1; i++) {
        const currentEnd = Number(sortedRanges[i].end);
        const nextStart = Number(sortedRanges[i + 1].start);
        if (currentEnd >= nextStart) {
          throw new BadRequestError("Overlapping page ranges are not permitted.", "OVERLAPPING_PAGE_RANGES");
        }
      }
    } else if (mode === "pages") {
      if (!Array.isArray(options.pages) || options.pages.length === 0) {
        throw new BadRequestError("At least one page must be selected.", "NO_PAGES_SELECTED");
      }

      const pageNums: number[] = [];
      for (let i = 0; i < options.pages.length; i++) {
        const p = Number(options.pages[i]);
        if (!Number.isInteger(p)) {
          throw new BadRequestError(`Invalid page number '${options.pages[i]}'.`, "INVALID_PAGE");
        }
        if (p < 1 || p > totalPages) {
          throw new BadRequestError(
            `Selected page ${p} is out of bounds (document has ${totalPages} pages).`,
            "PAGE_OUT_OF_BOUNDS"
          );
        }
        pageNums.push(p);
      }

      if (new Set(pageNums).size !== pageNums.length) {
        throw new BadRequestError("Duplicate page selections are not permitted.", "DUPLICATE_PAGE");
      }
    } else if (mode === "every-page") {
      if (totalPages > 100) {
        throw new BadRequestError(
          `Split operation cannot produce more than 100 output files at once (document has ${totalPages} pages).`,
          "MAX_OUTPUTS_EXCEEDED"
        );
      }
    }
  }

  // 4D. Rotate PDF Options & Validation
  if (normalizedTool === "rotate-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'rotate-pdf' accepts exactly 1 input file.");
    }

    const file = files[0]!;
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, file.storageKey);

    if (!fs.existsSync(physicalPath)) {
      throw new InvalidInputFileError("Physical input PDF does not exist on disk.");
    }

    let totalPages = 0;
    try {
      const pdfBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      totalPages = pdfDoc.getPageCount();
    } catch {
      throw new BadRequestError("Unable to read input PDF document.", "INVALID_PDF");
    }

    if (totalPages < 1) {
      throw new BadRequestError("The PDF document contains no pages.", "INVALID_PDF_PAGES");
    }

    // Support aliases: mode: "all" / "selected", angle, pages
    if (options.mode === "all" && options.angle !== undefined && options.rotation === undefined) {
      options.rotation = options.angle;
    }
    if (options.mode === "selected" && Array.isArray(options.pages) && options.rotations === undefined) {
      options.rotations = options.pages.map((p: any) => ({
        page: p.page,
        rotation: p.angle !== undefined ? p.angle : p.rotation,
      }));
    }

    if (options.rotations !== undefined) {
      if (!Array.isArray(options.rotations) || options.rotations.length === 0) {
        throw new BadRequestError(
          "Rotations must be a non-empty array of page rotation specifications.",
          "INVALID_TOOL_OPTIONS"
        );
      }

      for (let i = 0; i < options.rotations.length; i++) {
        const item = options.rotations[i];
        if (!item || typeof item !== "object") {
          throw new BadRequestError(`Invalid rotation specification at index ${i}.`, "INVALID_TOOL_OPTIONS");
        }
        const p = Number(item.page);
        if (!Number.isInteger(p)) {
          throw new BadRequestError(`Page number '${item.page}' must be an integer.`, "INVALID_PAGE");
        }
        if (p < 1 || p > totalPages) {
          throw new BadRequestError(
            `Page ${p} is out of bounds (document has ${totalPages} pages).`,
            "PAGE_OUT_OF_BOUNDS"
          );
        }

        let rot = Number(item.rotation);
        if (rot < 0) {
          rot = ((rot % 360) + 360) % 360;
        }
        if (!ALLOWED_ROTATION_ANGLES.has(rot)) {
          throw new BadRequestError(
            `Invalid rotation angle '${item.rotation}'. Allowed angles: 90, 180, 270 degrees.`,
            "INVALID_ROTATION_ANGLE"
          );
        }
        item.rotation = rot;
      }
    } else {
      let rot = options.rotation !== undefined ? Number(options.rotation) : 90;
      if (rot < 0) {
        rot = ((rot % 360) + 360) % 360;
      }
      if (!ALLOWED_ROTATION_ANGLES.has(rot)) {
        throw new BadRequestError(
          `Invalid rotation angle '${options.rotation}'. Allowed angles: 90, 180, 270 degrees.`,
          "INVALID_ROTATION_ANGLE"
        );
      }
      options.rotation = rot;
    }
  }

  return {
    validatedTool: normalizedTool,
    validatedInputFileIds: fileIds,
    validatedOptions: options,
  };
}

/**
 * Validates a job status filter parameter
 */
export function validateJobStatusFilter(status?: string): JobStatus {
  if (!status || !Object.values(JobStatus).includes(status as JobStatus)) {
    throw new InvalidJobStatusError(
      `Invalid job status filter '${status}'. Allowed: ${Object.values(JobStatus).join(", ")}`
    );
  }
  return status as JobStatus;
}
