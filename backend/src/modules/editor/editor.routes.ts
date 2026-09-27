import { Router, Request, Response } from "express";
import { sendSuccess, sendError } from "../../common/responses/apiResponse";
import { editorExportPayloadSchema } from "./editor.validation";

const router = Router();

/**
 * Editor Module Foundation Status & Capabilities
 * GET /api/v1/editor
 */
router.get("/", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "editor",
    phase: "5.1",
    status: "ready",
    capabilities: {
      supportedTools: [
        "select",
        "hand",
        "text",
        "image",
        "rectangle",
        "circle",
        "line",
        "arrow",
        "pen",
        "highlighter",
        "eraser",
        "signature",
      ],
      supportedFonts: ["Helvetica", "Times", "Courier", "Inter", "Roboto", "Arial"],
      supportedShapes: ["rectangle", "circle", "line", "arrow"],
      coordinateSystem: {
        unit: "pt",
        pointsPerInch: 72,
        origin: "top-left",
      },
      exportTargets: ["PDF 1.7", "PDF/A-1b", "PDF/A-2b"],
    },
  });
});

/**
 * Validate Editor Export Manifest
 * POST /api/v1/editor/validate
 */
router.post("/validate", (req: Request, res: Response) => {
  const parseResult = editorExportPayloadSchema.safeParse(req.body);

  if (!parseResult.success) {
    return sendError(
      res,
      "INVALID_EDITOR_PAYLOAD",
      "Invalid editor export payload schema",
      400,
      parseResult.error.format()
    );
  }

  const payload = parseResult.data;
  const totalObjects = payload.pages.reduce((acc, p) => acc + p.objects.length, 0);

  return sendSuccess(res, {
    valid: true,
    fileId: payload.fileId,
    pageCount: payload.pages.length,
    totalObjects,
  });
});

export default router;
