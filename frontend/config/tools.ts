import {
  Shrink, Combine, Scissors, ArrowRightLeft, FileText, Image as ImageIcon, Type, 
  Settings2, EyeOff, Search, Languages, MessageSquare, LayoutTemplate, Crop, Wand2, Layers, Lock, Unlock, User, LucideIcon
} from "lucide-react";

export type ToolCategory = "pdf" | "image" | "ai";

export interface ToolMetadata {
  slug: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  accept: string;
  maxSizeMB: number;
  actionType: "compress" | "merge" | "protect" | "resize" | "chat" | "basic";
  allowMultiple: boolean;
}

export const tools: ToolMetadata[] = [
  // PDF Tools (Phase 3 MVP & Phase 5)
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Reduce file size while optimizing for maximal PDF quality.",
    category: "pdf",
    icon: Shrink,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "compress",
    allowMultiple: false,
  },
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one unified document.",
    category: "pdf",
    icon: Combine,
    accept: ".pdf",
    maxSizeMB: 15,
    actionType: "merge",
    allowMultiple: true,
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Separate one page or a whole set for easy conversion into independent PDF files.",
    category: "pdf",
    icon: Scissors,
    accept: ".pdf",
    maxSizeMB: 15,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Easily convert your PDF files into easy to edit DOC and DOCX.",
    category: "pdf",
    icon: ArrowRightLeft,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert each PDF page into a JPG or extract all images contained in a PDF.",
    category: "pdf",
    icon: ImageIcon,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Adjust orientation and margins, and convert your JPG to PDF.",
    category: "pdf",
    icon: FileText,
    accept: ".jpg,.jpeg,.png",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: true,
  },
  {
    slug: "edit-pdf",
    title: "PDF Editor",
    description: "Add text, images, shapes or freehand annotations to a PDF document.",
    category: "pdf",
    icon: Type,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "watermark-pdf",
    title: "Watermark",
    description: "Stamp an image or text over your PDF in seconds.",
    category: "pdf",
    icon: Layers,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Encrypt your PDF with a password to keep sensitive data confidential.",
    category: "pdf",
    icon: Lock,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "protect",
    allowMultiple: false,
  },
  {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove PDF password security, giving you the freedom to use your PDFs as you want.",
    category: "pdf",
    icon: Unlock,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "protect", // Reusing protect UI for unlock
    allowMultiple: false,
  },
  
  // Image Tools (Phase 4)
  {
    slug: "resize-image",
    title: "Resize Image",
    description: "Resize JPG, PNG, SVG or GIF by defining new height and width pixels.",
    category: "image",
    icon: Settings2,
    accept: ".jpg,.jpeg,.png,.svg,.gif",
    maxSizeMB: 5,
    actionType: "resize",
    allowMultiple: false,
  },
  {
    slug: "compress-image",
    title: "Compress Image",
    description: "Compress JPG, PNG, SVG or GIF with the best quality and compression.",
    category: "image",
    icon: Shrink,
    accept: ".jpg,.jpeg,.png,.svg,.gif",
    maxSizeMB: 5,
    actionType: "compress",
    allowMultiple: false,
  },
  {
    slug: "crop-image",
    title: "Crop Image",
    description: "Crop JPG, PNG or GIF with ease. Choose pixels to define your rectangle or use our visual editor.",
    category: "image",
    icon: Crop,
    accept: ".jpg,.jpeg,.png,.gif",
    maxSizeMB: 5,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "remove-background",
    title: "Background Remover",
    description: "Automatically remove the background of an image and make it transparent.",
    category: "image",
    icon: EyeOff,
    accept: ".jpg,.jpeg,.png",
    maxSizeMB: 5,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "passport-photo",
    title: "Passport Photo Maker",
    description: "Create a standard size passport photo and print sheet instantly.",
    category: "image",
    icon: User,
    accept: ".jpg,.jpeg,.png",
    maxSizeMB: 5,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "signature-cleanup",
    title: "Signature Cleanup",
    description: "Clean up photographed signatures to have a pure white or transparent background.",
    category: "image",
    icon: Wand2,
    accept: ".jpg,.jpeg,.png",
    maxSizeMB: 5,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "photo-signature-maker",
    title: "Photo + Signature Maker",
    description: "Combine your photo and signature into a ready-to-upload format for government forms.",
    category: "image",
    icon: Combine,
    accept: ".jpg,.jpeg,.png",
    maxSizeMB: 5,
    actionType: "basic",
    allowMultiple: true,
  },
  
  // AI Tools (Phase 9 & Premium)
  {
    slug: "ai-summary",
    title: "AI PDF Summary",
    description: "Instantly summarize 100-page reports into bullet points and key takeaways.",
    category: "ai",
    icon: Search,
    accept: ".pdf",
    maxSizeMB: 20,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "chat-pdf",
    title: "Chat with PDF",
    description: "Ask questions and get answers directly from your document context.",
    category: "ai",
    icon: MessageSquare,
    accept: ".pdf",
    maxSizeMB: 20,
    actionType: "chat",
    allowMultiple: false,
  },
  {
    slug: "extract-data",
    title: "Extract Data",
    description: "Pull structured data like tables and names automatically using AI.",
    category: "ai",
    icon: LayoutTemplate,
    accept: ".pdf,.jpg,.jpeg,.png",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  },
  {
    slug: "translate-pdf",
    title: "Translate PDF",
    description: "Translate your document into over 100 languages while preserving layout.",
    category: "ai",
    icon: Languages,
    accept: ".pdf",
    maxSizeMB: 10,
    actionType: "basic",
    allowMultiple: false,
  }
];

export function getToolBySlug(slug: string): ToolMetadata | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
  return tools.filter((t) => t.category === category);
}
