import {
  Combine, Scissors, Shrink, FileText, Presentation, Table,
  Edit3, Image as ImageIcon, PenTool, Stamp, RotateCw, Code,
  Unlock, Shield, LayoutGrid, FileBadge, Wrench, ListOrdered,
  Scan, ScanText, Columns, Eraser, Crop, FormInput,
  Wand2, Languages, Braces, LucideIcon, Maximize, FileImage, MessageSquare
} from "lucide-react";

export type ToolCategory = "pdf" | "image" | "ai";

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
}

export const tools: ToolMetadata[] = [
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine PDFs in the order you want with the easiest PDF merger available.",
    category: "pdf", categories: ["Workflows", "Organize PDF"],
    icon: Combine, color: "text-red-500", bgColor: "bg-red-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "merge", allowMultiple: true,
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Separate one page or a whole set for easy conversion into independent PDF files.",
    category: "pdf", categories: ["Workflows", "Organize PDF"],
    icon: Scissors, color: "text-orange-500", bgColor: "bg-orange-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Reduce file size while optimizing for maximal PDF quality.",
    category: "pdf", categories: ["Optimize PDF", "Workflows"],
    icon: Shrink, color: "text-green-500", bgColor: "bg-green-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "compress", allowMultiple: false,
  },
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Easily convert your PDF files into easy to edit DOC and DOCX documents.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileText, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    description: "Turn your PDF files into easy to edit PPT and PPTX slideshows.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Presentation, color: "text-orange-600", bgColor: "bg-orange-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Pull data straight from PDFs into Excel spreadsheets in a few short seconds.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Table, color: "text-green-600", bgColor: "bg-green-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "word-to-pdf",
    title: "Word to PDF",
    description: "Make DOC and DOCX files easy to read by converting them to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100",
    accept: ".doc,.docx", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Make PPT and PPTX slideshows easy to view by converting them to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Presentation, color: "text-orange-500", bgColor: "bg-orange-50",
    accept: ".ppt,.pptx", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Make EXCEL spreadsheets easy to read by converting them to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Table, color: "text-green-500", bgColor: "bg-green-50",
    accept: ".xls,.xlsx", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "edit-pdf",
    title: "Edit PDF",
    description: "Add text, images, shapes or freehand annotations to a PDF document.",
    category: "pdf", categories: ["Edit PDF", "Workflows"],
    icon: Edit3, color: "text-purple-500", bgColor: "bg-purple-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "edit", allowMultiple: false,
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert each PDF page into a JPG or extract all images contained in a PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: ImageIcon, color: "text-yellow-500", bgColor: "bg-yellow-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Convert JPG images to PDF in seconds. Easily adjust orientation and margins.",
    category: "pdf", categories: ["Convert PDF"],
    icon: ImageIcon, color: "text-yellow-600", bgColor: "bg-yellow-100",
    accept: ".jpg,.jpeg,.png", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "sign-pdf",
    title: "Sign PDF",
    description: "Sign yourself or request electronic signatures from others.",
    category: "pdf", categories: ["PDF Security", "Workflows"],
    icon: PenTool, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "edit", allowMultiple: false,
  },
  {
    slug: "watermark",
    title: "Watermark PDF",
    description: "Stamp an image or text over your PDF in seconds.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Stamp, color: "text-red-500", bgColor: "bg-red-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate your PDFs the way you need them.",
    category: "pdf", categories: ["Organize PDF"],
    icon: RotateCw, color: "text-purple-600", bgColor: "bg-purple-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "rotate", allowMultiple: false,
  },
  {
    slug: "html-to-pdf",
    title: "HTML to PDF",
    description: "Convert webpages in HTML to PDF.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Code, color: "text-yellow-500", bgColor: "bg-yellow-50",
    accept: ".html,.htm", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove PDF password security.",
    category: "pdf", categories: ["PDF Security"],
    icon: Unlock, color: "text-blue-600", bgColor: "bg-blue-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "protect", allowMultiple: false,
  },
  {
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Protect PDF files with a password.",
    category: "pdf", categories: ["PDF Security"],
    icon: Shield, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "protect", allowMultiple: false,
  },
  {
    slug: "organize-pdf",
    title: "Organize PDF",
    description: "Sort pages of your PDF file however you like.",
    category: "pdf", categories: ["Organize PDF"],
    icon: LayoutGrid, color: "text-orange-500", bgColor: "bg-orange-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "pdf-to-pdfa",
    title: "PDF to PDF/A",
    description: "Transform your PDF to PDF/A for long-term archiving.",
    category: "pdf", categories: ["Convert PDF", "Optimize PDF"],
    icon: FileBadge, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "repair-pdf",
    title: "Repair PDF",
    description: "Repair a damaged PDF and recover data.",
    category: "pdf", categories: ["Optimize PDF"],
    icon: Wrench, color: "text-green-600", bgColor: "bg-green-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "page-numbers",
    title: "Page Numbers",
    description: "Add page numbers into PDFs with ease.",
    category: "pdf", categories: ["Edit PDF", "Organize PDF"],
    icon: ListOrdered, color: "text-purple-600", bgColor: "bg-purple-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "scan-to-pdf",
    title: "Scan to PDF",
    description: "Capture document scans from your mobile device and send them instantly to your browser.",
    category: "pdf", categories: ["Convert PDF"],
    icon: Scan, color: "text-orange-600", bgColor: "bg-orange-100",
    accept: ".jpg,.jpeg,.png", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "ocr-pdf",
    title: "OCR PDF",
    description: "Easily convert scanned PDF into searchable and selectable documents.",
    category: "pdf", categories: ["Convert PDF", "PDF Intelligence"],
    icon: ScanText, color: "text-green-500", bgColor: "bg-green-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "compare-pdf",
    title: "Compare PDF",
    description: "Show a side-by-side document comparison.",
    category: "pdf", categories: ["Edit PDF"],
    icon: Columns, color: "text-blue-600", bgColor: "bg-blue-100",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: true,
  },
  {
    slug: "redact-pdf",
    title: "Redact PDF",
    description: "Redact text and graphics to permanently remove sensitive information from a PDF.",
    category: "pdf", categories: ["PDF Security", "Edit PDF"],
    icon: Eraser, color: "text-blue-500", bgColor: "bg-blue-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "crop-pdf",
    title: "Crop PDF",
    description: "Crop margins of PDF documents or select specific areas.",
    category: "pdf", categories: ["Edit PDF", "Organize PDF"],
    icon: Crop, color: "text-purple-500", bgColor: "bg-purple-50",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "pdf-forms",
    title: "PDF Forms",
    description: "Create interactive fillable PDFs, or fill PDF forms yourself.",
    category: "pdf", categories: ["Edit PDF"],
    icon: FormInput, color: "text-purple-600", bgColor: "bg-purple-100", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  
  {
    slug: "ai-summarizer",
    title: "AI Summarizer",
    description: "Quickly generate concise summaries from articles, paragraphs, and essays.",
    category: "ai", categories: ["PDF Intelligence"],
    icon: Wand2, color: "text-purple-500", bgColor: "bg-purple-50", badge: "New!",
    accept: ".pdf,.txt,.docx", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "translate-pdf",
    title: "Translate PDF",
    description: "Easily translate PDF files powered by AI.",
    category: "ai", categories: ["PDF Intelligence"],
    icon: Languages, color: "text-purple-600", bgColor: "bg-purple-100", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "pdf-to-markdown",
    title: "PDF to Markdown",
    description: "Easily turn PDFs into Markdown files.",
    category: "ai", categories: ["Convert PDF", "PDF Intelligence"],
    icon: Braces, color: "text-purple-500", bgColor: "bg-purple-50", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "resize-pdf",
    title: "Resize PDF",
    description: "Change the size and dimensions of your PDF pages.",
    category: "pdf", categories: ["Edit PDF", "Organize PDF"],
    icon: Maximize, color: "text-blue-500", bgColor: "bg-blue-50", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "resize", allowMultiple: false,
  },
  {
    slug: "pdf-to-png",
    title: "PDF to PNG",
    description: "Convert PDF pages to PNG images or extract images.",
    category: "pdf", categories: ["Convert PDF"],
    icon: FileImage, color: "text-green-500", bgColor: "bg-green-50", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "basic", allowMultiple: false,
  },
  {
    slug: "chat-with-pdf",
    title: "Chat with PDF",
    description: "Upload your PDF and ask questions using AI to extract key insights.",
    category: "ai", categories: ["PDF Intelligence"],
    icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-100", badge: "New!",
    accept: ".pdf", maxSizeMB: 100, actionType: "chat", allowMultiple: false,
  },

];

export function getToolBySlug(slug: string): ToolMetadata | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolsByFilter(filter: string): ToolMetadata[] {
  if (filter === "All") return tools;
  return tools.filter((t) => t.categories.includes(filter));
}

export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
  return tools.filter((t) => t.category === category);
}
