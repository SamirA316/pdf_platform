import path from "path";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../common/prisma";
import {
  ALLOWED_TOOLS,
  ALLOWED_COMPRESS_LEVELS,
  ALLOWED_SPLIT_MODES,
  ALLOWED_ROTATION_ANGLES,
  ALLOWED_PAGE_SIZES,
  ALLOWED_RESIZE_UNITS,
  ALLOWED_ORIENTATIONS,
  STANDARD_PAGE_DIMENSIONS,
  ALLOWED_WATERMARK_TYPES,
  ALLOWED_WATERMARK_POSITIONS,
  ALLOWED_PAGE_NUMBER_POSITIONS,
  JobStatus,
} from "./job.constants";
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

  let normalizedTool = data.tool.trim().toLowerCase();
  if (normalizedTool === "watermark") {
    normalizedTool = "watermark-pdf";
  }
  if (normalizedTool === "add-page-numbers" || normalizedTool === "pagenumbers") {
    normalizedTool = "page-numbers";
  }
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

  // 4E. Organize PDF Options & Validation
  if (normalizedTool === "organize-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'organize-pdf' accepts exactly 1 input file.");
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

    if (!options || !Array.isArray(options.pages) || options.pages.length === 0) {
      throw new BadRequestError(
        "At least one page specification is required in 'pages' array.",
        "INVALID_TOOL_OPTIONS"
      );
    }

    if (options.pages.length > 200) {
      throw new BadRequestError(
        "Organize PDF cannot produce more than 200 pages at once.",
        "MAX_OUTPUT_PAGES_EXCEEDED"
      );
    }

    const normalizedPages: Array<{ sourcePage: number; rotation: number }> = [];

    for (let i = 0; i < options.pages.length; i++) {
      const item = options.pages[i];
      let sourcePage: number;
      let rot = 0;

      if (typeof item === "number") {
        sourcePage = item;
      } else if (item && typeof item === "object") {
        sourcePage = Number(item.sourcePage);
        if (item.rotation !== undefined) {
          rot = Number(item.rotation);
          if (rot < 0) {
            rot = ((rot % 360) + 360) % 360;
          }
          if (rot % 90 !== 0) {
            throw new BadRequestError(
              `Invalid rotation angle '${item.rotation}'. Allowed angles: 0, 90, 180, 270 degrees.`,
              "INVALID_ROTATION_ANGLE"
            );
          }
          rot = rot % 360;
        }
      } else {
        throw new BadRequestError(`Invalid page specification at index ${i}.`, "INVALID_PAGE");
      }

      if (!Number.isInteger(sourcePage)) {
        throw new BadRequestError(`Source page at index ${i} must be an integer.`, "INVALID_PAGE");
      }

      if (sourcePage < 1 || sourcePage > totalPages) {
        throw new BadRequestError(
          `Source page ${sourcePage} is out of bounds (document has ${totalPages} pages).`,
          "PAGE_OUT_OF_BOUNDS"
        );
      }

      normalizedPages.push({
        sourcePage,
        rotation: rot,
      });
    }

    options.pages = normalizedPages;
  }

  // 4F. Resize PDF Options & Validation
  if (normalizedTool === "resize-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'resize-pdf' accepts exactly 1 input file.");
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

    // Validate size preset
    if (!options.size || typeof options.size !== "string") {
      throw new BadRequestError(
        `Resize option 'size' is required. Allowed: ${Array.from(ALLOWED_PAGE_SIZES).join(", ")}`,
        "INVALID_TOOL_OPTIONS"
      );
    }

    const normalizedSize = options.size.trim().toLowerCase();
    if (!ALLOWED_PAGE_SIZES.has(normalizedSize)) {
      throw new BadRequestError(
        `Invalid page size '${options.size}'. Allowed: ${Array.from(ALLOWED_PAGE_SIZES).join(", ")}`,
        "INVALID_PAGE_SIZE"
      );
    }

    // Validate orientation
    let normalizedOrientation = "portrait";
    if (options.orientation !== undefined) {
      if (typeof options.orientation !== "string") {
        throw new BadRequestError("Orientation must be a string ('portrait' or 'landscape').", "INVALID_TOOL_OPTIONS");
      }
      const rawOrientation = options.orientation.trim().toLowerCase();
      if (!ALLOWED_ORIENTATIONS.has(rawOrientation)) {
        throw new BadRequestError(
          `Invalid orientation '${options.orientation}'. Allowed: portrait, landscape`,
          "INVALID_ORIENTATION"
        );
      }
      normalizedOrientation = rawOrientation;
    }

    let targetWidthPt = 0;
    let targetHeightPt = 0;

    if (normalizedSize === "custom") {
      const width = Number(options.width);
      const height = Number(options.height);

      if (options.width === undefined || options.height === undefined || isNaN(width) || isNaN(height)) {
        throw new BadRequestError(
          "Custom page size requires positive numeric 'width' and 'height'.",
          "INVALID_DIMENSIONS"
        );
      }

      if (width <= 0 || height <= 0) {
        throw new BadRequestError(
          "Custom width and height must be positive numbers greater than 0.",
          "INVALID_DIMENSIONS"
        );
      }

      let unit = "mm";
      if (options.unit !== undefined) {
        if (typeof options.unit !== "string") {
          throw new BadRequestError("Unit must be a string ('mm', 'inch', or 'pt').", "INVALID_TOOL_OPTIONS");
        }
        const rawUnit = options.unit.trim().toLowerCase();
        if (!ALLOWED_RESIZE_UNITS.has(rawUnit)) {
          throw new BadRequestError(
            `Invalid unit '${options.unit}'. Allowed units: mm, inch, pt`,
            "INVALID_UNIT"
          );
        }
        unit = rawUnit === "in" ? "inch" : rawUnit;
      }

      // Convert dimensions to PDF points (72 pt per inch, 25.4 mm per inch)
      if (unit === "mm") {
        targetWidthPt = width * (72 / 25.4);
        targetHeightPt = height * (72 / 25.4);
      } else if (unit === "inch") {
        targetWidthPt = width * 72;
        targetHeightPt = height * 72;
      } else {
        targetWidthPt = width;
        targetHeightPt = height;
      }

      // Bounds: min 10 pt, max 5000 pt
      if (targetWidthPt < 10 || targetHeightPt < 10) {
        throw new BadRequestError(
          "Custom page dimensions are too small (minimum 10 points equivalent).",
          "INVALID_DIMENSIONS"
        );
      }

      if (targetWidthPt > 5000 || targetHeightPt > 5000) {
        throw new BadRequestError(
          "Custom page dimensions exceed maximum allowed size (5000 points equivalent).",
          "OVERSIZED_DIMENSIONS"
        );
      }

      options.width = width;
      options.height = height;
      options.unit = unit;
      options.targetWidthPt = targetWidthPt;
      options.targetHeightPt = targetHeightPt;
    } else {
      const presetDims = STANDARD_PAGE_DIMENSIONS[normalizedSize]!;
      targetWidthPt = presetDims.width;
      targetHeightPt = presetDims.height;
      options.targetWidthPt = targetWidthPt;
      options.targetHeightPt = targetHeightPt;
    }

    options.size = normalizedSize;
    options.orientation = normalizedOrientation;
  }

  // 4G. Watermark PDF Options & Validation
  if (normalizedTool === "watermark-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'watermark-pdf' accepts exactly 1 input PDF file.");
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

    // Default type to text if not specified
    const type = (options.type || "text").toString().trim().toLowerCase();
    if (!ALLOWED_WATERMARK_TYPES.has(type)) {
      throw new BadRequestError(
        `Invalid watermark type '${options.type}'. Allowed: text, image`,
        "INVALID_TOOL_OPTIONS"
      );
    }
    options.type = type;

    // Validate position
    let position = (options.position || "center").toString().trim().toLowerCase();
    if (!ALLOWED_WATERMARK_POSITIONS.has(position)) {
      throw new BadRequestError(
        `Invalid watermark position '${options.position}'. Allowed: center, top-left, top-right, bottom-left, bottom-right`,
        "INVALID_TOOL_OPTIONS"
      );
    }
    options.position = position;

    // Validate opacity
    let opacity = options.opacity !== undefined ? Number(options.opacity) : (type === "text" ? 0.3 : 0.4);
    if (isNaN(opacity) || opacity < 0.01 || opacity > 1.0) {
      throw new BadRequestError("Watermark opacity must be a number between 0.01 and 1.0.", "INVALID_TOOL_OPTIONS");
    }
    options.opacity = opacity;

    // Validate rotation
    let rotation = options.rotation !== undefined ? Number(options.rotation) : (type === "text" ? 45 : 0);
    if (isNaN(rotation)) {
      throw new BadRequestError("Watermark rotation must be a valid numeric degree.", "INVALID_TOOL_OPTIONS");
    }
    options.rotation = ((rotation % 360) + 360) % 360;

    // Validate pages specification
    if (options.pages !== undefined && options.pages !== "all") {
      if (!Array.isArray(options.pages) || options.pages.length === 0) {
        throw new BadRequestError("Pages option must be 'all' or a non-empty array of page numbers.", "INVALID_TOOL_OPTIONS");
      }
      const pageList: number[] = [];
      for (const p of options.pages) {
        const pageNum = Number(p);
        if (!Number.isInteger(pageNum)) {
          throw new BadRequestError(`Page number '${p}' must be an integer.`, "INVALID_PAGE");
        }
        if (pageNum < 1 || pageNum > totalPages) {
          throw new BadRequestError(
            `Page ${pageNum} is out of bounds (document has ${totalPages} pages).`,
            "PAGE_OUT_OF_BOUNDS"
          );
        }
        pageList.push(pageNum);
      }
      options.pages = pageList;
    } else {
      options.pages = "all";
    }

    if (type === "text") {
      const text = typeof options.text === "string" ? options.text.trim() : "";
      if (!text) {
        throw new BadRequestError("Watermark text is required and cannot be empty.", "INVALID_WATERMARK_TEXT");
      }
      if (text.length > 200) {
        throw new BadRequestError("Watermark text cannot exceed 200 characters.", "INVALID_WATERMARK_TEXT");
      }
      options.text = text;

      let fontSize = options.fontSize !== undefined ? Number(options.fontSize) : 40;
      if (isNaN(fontSize) || fontSize < 6 || fontSize > 200) {
        throw new BadRequestError("Font size must be a number between 6 and 200.", "INVALID_TOOL_OPTIONS");
      }
      options.fontSize = fontSize;

      let color = typeof options.color === "string" && options.color.trim() ? options.color.trim() : "#000000";
      options.color = color;
    } else if (type === "image") {
      const imageFileId = typeof options.imageFileId === "string" ? options.imageFileId.trim() : "";
      if (!imageFileId) {
        throw new BadRequestError("Image watermark requires 'imageFileId'.", "INVALID_WATERMARK_IMAGE");
      }

      const imgDbFile = await prisma.file.findFirst({
        where: { id: imageFileId, userId },
      });

      if (!imgDbFile) {
        throw new BadRequestError("Watermark image file not found or not owned by user.", "INVALID_INPUT_FILE");
      }

      if (imgDbFile.status !== "READY") {
        throw new BadRequestError("Watermark image file is not ready for processing.", "INVALID_INPUT_FILE");
      }

      const allowedMimes = new Set(["image/png", "image/jpeg", "image/jpg"]);
      if (!allowedMimes.has(imgDbFile.mimeType.toLowerCase())) {
        throw new BadRequestError("Watermark image must be a PNG or JPEG file.", "INVALID_MIME_TYPE");
      }

      const imgPhysicalPath = path.resolve(uploadBase, imgDbFile.storageKey);
      if (!fs.existsSync(imgPhysicalPath)) {
        throw new BadRequestError("Watermark image physical file is missing on disk.", "INVALID_INPUT_FILE");
      }

      let scale = options.scale !== undefined ? Number(options.scale) : 0.5;
      if (isNaN(scale) || scale < 0.05 || scale > 5.0) {
        throw new BadRequestError("Watermark image scale must be a number between 0.05 and 5.0.", "INVALID_TOOL_OPTIONS");
      }
      options.scale = scale;
      options.imageFileId = imageFileId;
    }
  }

  // 4H. Page Numbers Options & Validation
  if (normalizedTool === "page-numbers") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'page-numbers' accepts exactly 1 input PDF file.");
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

    // Validate position
    let position = (options.position || "bottom-center").toString().trim().toLowerCase();
    if (!ALLOWED_PAGE_NUMBER_POSITIONS.has(position)) {
      throw new BadRequestError(
        `Invalid page numbers position '${options.position}'. Allowed: ${Array.from(ALLOWED_PAGE_NUMBER_POSITIONS).join(", ")}`,
        "INVALID_TOOL_OPTIONS"
      );
    }
    options.position = position;

    // Validate startNumber
    let startNumber = options.startNumber !== undefined ? Number(options.startNumber) : 1;
    if (!Number.isInteger(startNumber) || startNumber < 1) {
      throw new BadRequestError("Starting page number must be an integer >= 1.", "INVALID_START_NUMBER");
    }
    options.startNumber = startNumber;

    // Validate fontSize
    let fontSize = options.fontSize !== undefined ? Number(options.fontSize) : 12;
    if (isNaN(fontSize) || fontSize < 6 || fontSize > 48) {
      throw new BadRequestError("Font size must be a number between 6 and 48.", "INVALID_TOOL_OPTIONS");
    }
    options.fontSize = fontSize;

    // Validate margin
    let margin = options.margin !== undefined ? Number(options.margin) : 30;
    if (isNaN(margin) || margin < 5 || margin > 150) {
      throw new BadRequestError("Margin must be a number between 5 and 150 pt.", "INVALID_TOOL_OPTIONS");
    }
    options.margin = margin;

    // Validate format string
    let format = typeof options.format === "string" && options.format.trim() ? options.format.trim() : "Page {n} / {total}";
    if (format.length > 50) {
      throw new BadRequestError("Format template string cannot exceed 50 characters.", "INVALID_TOOL_OPTIONS");
    }
    options.format = format;

    // Validate color
    options.color = typeof options.color === "string" && options.color.trim() ? options.color.trim() : "#000000";

    // Validate pages specification
    if (options.pages !== undefined && options.pages !== "all") {
      if (!Array.isArray(options.pages) || options.pages.length === 0) {
        throw new BadRequestError("Pages option must be 'all' or a non-empty array of page numbers.", "INVALID_TOOL_OPTIONS");
      }
      const pageList: number[] = [];
      for (const p of options.pages) {
        const pageNum = Number(p);
        if (!Number.isInteger(pageNum)) {
          throw new BadRequestError(`Page number '${p}' must be an integer.`, "INVALID_PAGE");
        }
        if (pageNum < 1 || pageNum > totalPages) {
          throw new BadRequestError(
            `Page ${pageNum} is out of bounds (document has ${totalPages} pages).`,
            "PAGE_OUT_OF_BOUNDS"
          );
        }
        pageList.push(pageNum);
      }
      options.pages = pageList;
    } else {
      options.pages = "all";
    }
  }

  // 4I. Protect PDF Options & Validation
  if (normalizedTool === "protect-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'protect-pdf' accepts exactly 1 input PDF file.");
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

    const userPassword = typeof options.userPassword === "string" ? options.userPassword : "";
    if (!userPassword) {
      throw new BadRequestError("A non-empty 'userPassword' is required to protect the PDF.", "INVALID_PASSWORD");
    }

    if (userPassword.length > 128) {
      throw new BadRequestError("Password length cannot exceed 128 characters.", "INVALID_PASSWORD");
    }

    options.userPassword = userPassword;
    options.permissions = {
      print: options.permissions?.print !== false,
      copy: Boolean(options.permissions?.copy),
      modify: Boolean(options.permissions?.modify),
      annotate: Boolean(options.permissions?.annotate),
    };
  }

  // 4J. Unlock PDF Options & Validation
  if (normalizedTool === "unlock-pdf") {
    if (fileIds.length !== 1) {
      throw new InvalidInputFileError("Tool 'unlock-pdf' accepts exactly 1 input PDF file.");
    }

    const file = files[0]!;
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, file.storageKey);

    if (!fs.existsSync(physicalPath)) {
      throw new InvalidInputFileError("Physical input PDF does not exist on disk.");
    }

    const password = typeof options.password === "string" ? options.password : "";
    if (!password) {
      throw new BadRequestError("A password is required to unlock this PDF.", "INVALID_PASSWORD");
    }

    options.password = password;
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
