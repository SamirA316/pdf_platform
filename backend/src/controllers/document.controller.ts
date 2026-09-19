import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { AuthRequest } from "./auth.controller";

const prisma = new PrismaClient();

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

    res.status(201).json({ message: "File uploaded successfully", document });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const documentId = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (document.userId !== userId) {
      res.status(403).json({ error: "Unauthorized to delete this document" });
      return;
    }

    // Delete physical file
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Delete database record
    await prisma.document.delete({
      where: { id: documentId },
    });

    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const documentId = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (document.userId !== userId) {
      res.status(403).json({ error: "Unauthorized to access this document" });
      return;
    }

    if (!fs.existsSync(document.path)) {
      res.status(404).json({ error: "Physical file not found on server" });
      return;
    }

    res.download(document.path, document.originalName);
  } catch (error) {
    console.error("Download document error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
