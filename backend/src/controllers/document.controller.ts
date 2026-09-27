import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../common/prisma";
import { storageService } from "../modules/files/storage.service";
import { logger } from "../common/logger";

import { GUEST_USER_ID } from "../middlewares/auth.middleware";

export interface IPublicDocumentDto {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicDocument(document: any): IPublicDocumentDto {
  return {
    id: document.id,
    filename: document.filename,
    originalName: document.originalName,
    size: document.size,
    type: document.type,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const document = await prisma.document.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        type: "UPLOAD",
        path: file.path,
        userId: userId,
      },
    });

    res.status(201).json({
      message: "File uploaded successfully",
      document: toPublicDocument(document),
    });
  } catch (error) {
    logger.error("Upload error", "HTTP");
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    if (userId === GUEST_USER_ID) {
      res.status(200).json({ documents: [] });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      documents: documents.map(toPublicDocument),
    });
  } catch (error) {
    logger.error("Get documents error", "HTTP");
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const documentId = req.params.id as string;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId,
      },
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.status(200).json({
      document: toPublicDocument(document),
    });
  } catch (error) {
    logger.error("Get document error", "HTTP");
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const documentId = req.params.id as string;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId,
      },
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Safely delete physical file ensuring it resides within uploads directory
    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.isAbsolute(document.path)
      ? path.resolve(document.path)
      : path.resolve(uploadBase, document.path);

    const relativeToUpload = path.relative(uploadBase, physicalPath);
    const isSafe =
      !relativeToUpload.startsWith("..") &&
      !path.isAbsolute(relativeToUpload) &&
      physicalPath.startsWith(uploadBase + path.sep);

    if (isSafe && fs.existsSync(physicalPath)) {
      try {
        fs.unlinkSync(physicalPath);
      } catch {
        logger.warn("Failed to unlink document file.", "STORAGE");
      }
    }

    // Delete database record
    await prisma.document.delete({
      where: { id: documentId },
    });

    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    logger.error("Delete document error", "HTTP");
    res.status(500).json({ error: "Internal server error" });
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const documentId = req.params.id as string;

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId,
      },
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.isAbsolute(document.path)
      ? path.resolve(document.path)
      : path.resolve(uploadBase, document.path);

    const relativeToUpload = path.relative(uploadBase, physicalPath);
    const isSafe =
      !relativeToUpload.startsWith("..") &&
      !path.isAbsolute(relativeToUpload) &&
      physicalPath.startsWith(uploadBase + path.sep);

    if (!isSafe || !fs.existsSync(physicalPath)) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.download(physicalPath, document.originalName);
  } catch (error) {
    logger.error("Download document error", "HTTP");
    res.status(500).json({ error: "Internal server error" });
  }
};
