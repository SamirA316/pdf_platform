import {
  Combine, Scissors, Shrink, FileText, Presentation, Table,
  Edit3, Image as ImageIcon, PenTool, Stamp, RotateCw, Code,
  Unlock, Shield, LayoutGrid, FileBadge, Wrench, ListOrdered,
  Scan, ScanText, Columns, Eraser, Crop, FormInput,
  Wand2, Languages, Braces, LucideIcon, Maximize, FileImage, MessageSquare
} from "lucide-react";

export type ToolCategory = "pdf" | "image" | "ai";
export type ToolStatus = "READY" | "COMING_SOON";

export const DEFAULT_MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 50);

export const CORE_12_TOOL_SLUGS = new Set([
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "rotate-pdf",
  "organize-pdf",
  "resize-pdf",
  "watermark",
  "page-numbers",
  "protect-pdf",
  "unlock-pdf",
  "repair-pdf",
  "pdf-to-pdfa",
]);

export interface ToolMetadata {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  categories: string[];
  icon: LucideIcon;
  color: string;
  bgColor: string;
  badge?: string;
  accept: string;
  maxSizeMB: number;
  actionType: "compress" | "merge" | "protect" | "resize" | "chat" | "rotate" | "edit" | "basic";
  allowMultiple: boolean;
  status: ToolStatus;
  backendEndpoint?: string;
  processor?: string;
}

export const tools: ToolMetadata[] = [
  // --- 12 CORE PRODUCTION PDF TOOLS (READY FOR BETA) ---
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDF files into a single unified document with custom page ordering.",
    category: "pdf", categories: ["Workflows", "Organize PDF"],
    icon: Combine, color: "text-red-500", bgColor: "bg-red-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "merge", allowMultiple: true,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "MergeProcessor",
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Separate specific pages or entire page ranges into independent PDF documents.",
    category: "pdf", categories: ["Workflows", "Organize PDF"],
    icon: Scissors, color: "text-orange-500", bgColor: "bg-orange-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "SplitProcessor",
  },
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Reduce file size while optimizing for maximal PDF visual clarity and readability.",
    category: "pdf", categories: ["Optimize PDF", "Workflows"],
    icon: Shrink, color: "text-green-500", bgColor: "bg-green-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "compress", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "CompressProcessor",
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate your PDF pages clockwise, counter-clockwise or 180 degrees permanently.",
    category: "pdf", categories: ["Organize PDF"],
    icon: RotateCw, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "rotate", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "RotateProcessor",
  },
  {
    slug: "organize-pdf",
    title: "Organize PDF",
    description: "Sort, reorder, delete, and rearrange pages in your PDF document visually.",
    category: "pdf", categories: ["Organize PDF"],
    icon: LayoutGrid, color: "text-red-500", bgColor: "bg-red-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "OrganizeProcessor",
  },
  {
    slug: "resize-pdf",
    title: "Resize PDF",
    description: "Scale page dimensions to standard sizes like A4, Letter, Legal, or custom sizes.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Maximize, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "resize", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "ResizeProcessor",
  },
  {
    slug: "watermark",
    title: "Watermark PDF",
    description: "Stamp customized text or image watermarks onto your PDF pages with full positioning.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Stamp, color: "text-indigo-500", bgColor: "bg-indigo-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "WatermarkProcessor",
  },
  {
    slug: "page-numbers",
    title: "Page Numbers",
    description: "Add clean, formatted page numbering into your PDF documents with custom styling.",
    category: "pdf", categories: ["Edit PDF"],
    icon: ListOrdered, color: "text-emerald-500", bgColor: "bg-emerald-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "PageNumbersProcessor",
  },
  {
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Encrypt and password-protect sensitive PDF documents with AES-256 encryption.",
    category: "pdf", categories: ["Security"],
    icon: Shield, color: "text-yellow-600", bgColor: "bg-yellow-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "protect", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "ProtectProcessor",
  },
  {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove security and password protection from authorized PDF files.",
    category: "pdf", categories: ["Security"],
    icon: Unlock, color: "text-teal-500", bgColor: "bg-teal-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "protect", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "UnlockProcessor",
  },
  {
    slug: "repair-pdf",
    title: "Repair PDF",
    description: "Repair damaged or corrupted PDF files and recover intact text and graphics data.",
    category: "pdf", categories: ["Optimize PDF"],
    icon: Wrench, color: "text-amber-500", bgColor: "bg-amber-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "RepairProcessor",
  },
  {
    slug: "pdf-to-pdfa",
    title: "PDF to PDF/A",
    description: "Convert your PDF documents to ISO-standardized PDF/A for long-term legal archiving.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileBadge, color: "text-rose-500", bgColor: "bg-rose-50",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "READY",
    backendEndpoint: "POST /api/v1/jobs",
    processor: "PdfaProcessor",
  },

  // --- UPCOMING TOOLS (COMING SOON IN FUTURE RELEASES) ---
  {
    slug: "edit-pdf",
    title: "Edit PDF",
    description: "Add text, annotations, and visual markup to PDF documents.",
    category: "pdf", categories: ["Edit PDF", "Workflows"],
    icon: Edit3, color: "text-purple-500", bgColor: "bg-purple-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "edit", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Convert your PDF files into editable DOC and DOCX documents.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileText, color: "text-blue-500", bgColor: "bg-blue-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    description: "Turn your PDF files into editable PPT and PPTX slideshows.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Presentation, color: "text-orange-600", bgColor: "bg-orange-100",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Pull tabular data straight from PDFs into Excel spreadsheets.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Table, color: "text-green-600", bgColor: "bg-green-100",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "word-to-pdf",
    title: "Word to PDF",
    description: "Make DOC and DOCX files easy to read by converting them to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100",
    badge: "Coming Soon",
    accept: ".doc,.docx", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Make PPT and PPTX slideshows easy to view by converting them to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Presentation, color: "text-orange-500", bgColor: "bg-orange-50",
    badge: "Coming Soon",
    accept: ".ppt,.pptx", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Convert Excel spreadsheets to professional PDF documents.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Table, color: "text-green-500", bgColor: "bg-green-50",
    badge: "Coming Soon",
    accept: ".xls,.xlsx", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Extract images or turn every PDF page into a high-res JPG image.",
    category: "pdf", categories: ["Convert PDF"],
    icon: ImageIcon, color: "text-yellow-500", bgColor: "bg-yellow-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Convert JPG, PNG, and WebP images to standalone PDF files.",
    category: "pdf", categories: ["Convert PDF"],
    icon: ImageIcon, color: "text-yellow-600", bgColor: "bg-yellow-100",
    badge: "Coming Soon",
    accept: ".jpg,.jpeg,.png", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "sign-pdf",
    title: "Sign PDF",
    description: "Sign PDF documents digitally and request verified signatures.",
    category: "pdf", categories: ["Security"],
    icon: PenTool, color: "text-green-500", bgColor: "bg-green-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "html-to-pdf",
    title: "HTML to PDF",
    description: "Convert webpages or raw HTML files into high-fidelity PDF documents.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Code, color: "text-indigo-500", bgColor: "bg-indigo-50",
    badge: "Coming Soon",
    accept: ".html,.htm", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "scan-to-pdf",
    title: "Scan to PDF",
    description: "Capture documents from scanners or camera uploads into PDF files.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Scan, color: "text-teal-600", bgColor: "bg-teal-50",
    badge: "Coming Soon",
    accept: ".jpg,.jpeg,.png", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "ocr-pdf",
    title: "OCR PDF",
    description: "Convert scanned PDFs into searchable and selectable text documents.",
    category: "pdf", categories: ["Convert PDF"],
    icon: ScanText, color: "text-blue-600", bgColor: "bg-blue-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "compare-pdf",
    title: "Compare PDF",
    description: "Compare two PDF documents side by side and highlight visual differences.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Columns, color: "text-violet-500", bgColor: "bg-violet-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: true,
    status: "COMING_SOON",
  },
  {
    slug: "redact-pdf",
    title: "Redact PDF",
    description: "Permanently blackout sensitive text and graphics in confidential PDFs.",
    category: "pdf", categories: ["Security"],
    icon: Eraser, color: "text-slate-600", bgColor: "bg-slate-100",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "crop-pdf",
    title: "Crop PDF",
    description: "Trim page margins or select custom crop boxes across PDF pages.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Crop, color: "text-orange-500", bgColor: "bg-orange-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-forms",
    title: "PDF Forms",
    description: "Create and fill interactive form fields and checkboxes in PDFs.",
    category: "pdf", categories: ["Edit PDF"],
    icon: FormInput, color: "text-purple-600", bgColor: "bg-purple-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "ai-summarizer",
    title: "AI Summarizer",
    description: "Generate instant intelligent executive summaries of long PDF documents.",
    category: "ai", categories: ["AI PDF"],
    icon: Wand2, color: "text-fuchsia-500", bgColor: "bg-fuchsia-50",
    badge: "Coming Soon",
    accept: ".pdf,.txt,.docx", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "translate-pdf",
    title: "Translate PDF",
    description: "Translate PDF text into over 50 global languages while preserving layout.",
    category: "ai", categories: ["AI PDF"],
    icon: Languages, color: "text-cyan-500", bgColor: "bg-cyan-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-markdown",
    title: "PDF to Markdown",
    description: "Convert technical PDFs into clean, formatted Markdown for documentation.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Braces, color: "text-slate-500", bgColor: "bg-slate-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "pdf-to-png",
    title: "PDF to PNG",
    description: "Render high-DPI lossless PNG graphics from each PDF page.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileImage, color: "text-emerald-500", bgColor: "bg-emerald-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "basic", allowMultiple: false,
    status: "COMING_SOON",
  },
  {
    slug: "chat-with-pdf",
    title: "Chat with PDF",
    description: "Ask questions, extract facts, and analyze documents through AI dialogue.",
    category: "ai", categories: ["AI PDF"],
    icon: MessageSquare, color: "text-sky-500", bgColor: "bg-sky-50",
    badge: "Coming Soon",
    accept: ".pdf", maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB, actionType: "chat", allowMultiple: false,
    status: "COMING_SOON",
  },
];

export function getToolBySlug(slug: string): ToolMetadata | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getReadyTools(): ToolMetadata[] {
  return tools.filter((t) => t.status === "READY");
}

export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
  return tools.filter((t) => t.category === category);
}

export function getToolsByFilter(filter: string): ToolMetadata[] {
  if (filter === "All" || filter === "Core Tools") {
    // In Production Beta, prioritize the 12 Core Tools as the primary launch catalog
    return tools.filter((t) => t.status === "READY");
  }
  if (filter === "Coming Soon") {
    return tools.filter((t) => t.status === "COMING_SOON");
  }
  if (filter === "All Tools (Overview)") {
    return tools;
  }
  return tools.filter((t) => t.categories && t.categories.includes(filter));
}
