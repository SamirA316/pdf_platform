import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import Link from "next/link";
import { BookOpen, FileText, Lock, PenTool, LayoutDashboard, Settings } from "lucide-react";

export default function GuidesPage() {
  const guideCategories = [
    {
      title: "PDF Basics",
      icon: BookOpen,
      guides: [
        "What is a PDF file?",
        "How to open and view PDFs on any device",
        "Understanding PDF metadata and properties",
        "The history and evolution of the PDF format"
      ]
    },
    {
      title: "Editing & Modifying",
      icon: PenTool,
      guides: [
        "How to edit text and images in a PDF",
        "Merging multiple PDFs into a single document",
        "Splitting a large PDF into smaller files",
        "How to rotate or delete specific pages"
      ]
    },
    {
      title: "Security & Privacy",
      icon: Lock,
      guides: [
        "How to password protect a PDF",
        "Redacting sensitive information before sharing",
        "How to add a digital signature to a document",
        "Understanding PDF encryption standards"
      ]
    },
    {
      title: "Conversion",
      icon: FileText,
      guides: [
        "Converting Word documents to PDF",
        "How to turn images (JPG/PNG) into a PDF",
        "Converting a PDF to Excel for data extraction",
        "Making a PDF text-searchable (OCR)"
      ]
    },
    {
      title: "Optimization",
      icon: Settings,
      guides: [
        "How to compress a PDF without losing quality",
        "Optimizing PDFs for web viewing",
        "Repairing corrupted PDF files",
        "Flattening a PDF to prevent unwanted editing"
      ]
    },
    {
      title: "Platform Features",
      icon: LayoutDashboard,
      guides: [
        "Navigating the QuickPDF dashboard",
        "Managing your account and subscription",
        "Setting up custom API integrations",
        "Using the offline desktop application"
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto text-center md:text-left">
          <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-6 leading-tight">
            User Guides & Tutorials
          </h1>
          <p className="text-lg md:text-xl text-[#4A4A55] max-w-2xl font-medium leading-relaxed">
            Step-by-step instructions on how to get the most out of QuickPDF. From basic operations to advanced workflows, we&apos;ve got you covered.
          </p>
        </section>

        {/* Guides Grid */}
        <section className="px-4 sm:px-6 lg:px-8 mb-24 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {guideCategories.map((category, i) => {
              const Icon = category.icon;
              return (
                <div key={i} className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-shadow duration-300">
                  <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-[#E5322D] rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" strokeWidth={2} />
                    </div>
                    <h2 className="text-xl font-bold text-[#33333B]">{category.title}</h2>
                  </div>
                  <div className="p-8 flex-1">
                    <ul className="space-y-4">
                      {category.guides.map((guide, j) => (
                        <li key={j}>
                          <Link href={`/guides/${guide.toLowerCase().replace(/ /g, '-')}`} className="text-[#4A4A55] text-[15px] font-medium hover:text-[#E5322D] transition-colors flex items-start gap-3 group">
                            <span className="text-[#E5322D] mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">•</span>
                            <span className="leading-snug">{guide}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="px-8 pb-8">
                    <Link href={`/guides/category/${category.title.toLowerCase().replace(/ /g, '-')}`} className="text-[#E5322D] text-[14px] font-bold hover:underline">
                      View all {category.title} guides →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
