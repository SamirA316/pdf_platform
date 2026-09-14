"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { tools, ToolMetadata } from "@/config/tools";
import { useAuth } from "@/context/AuthContext";

const getTools = (slugs: string[]) => slugs.map(s => tools.find(t => t.slug === s)).filter(Boolean) as ToolMetadata[];

const megaMenuColumns = [
  {
    title: "Organize PDF",
    items: getTools(["merge-pdf", "split-pdf", "organize-pdf", "scan-to-pdf"])
  },
  {
    title: "Optimize PDF",
    items: getTools(["compress-pdf", "repair-pdf", "ocr-pdf"])
  },
  {
    title: "Convert to PDF",
    items: getTools(["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "html-to-pdf"])
  },
  {
    title: "Convert from PDF",
    items: getTools(["pdf-to-jpg", "pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "pdf-to-pdfa"])
  },
  {
    title: "Edit PDF",
    items: getTools(["rotate-pdf", "page-numbers", "watermark", "crop-pdf", "edit-pdf", "pdf-forms"])
  },
  {
    title: "Security & AI",
    items: getTools(["unlock-pdf", "protect-pdf", "sign-pdf", "redact-pdf", "compare-pdf", "ai-summarizer", "translate-pdf", "pdf-to-markdown"])
  }
];



export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#E5E5E5]">
      <div className="container mx-auto flex h-[64px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8 relative">
        
        {/* Left Side: Logo & Main Links */}
        <div className="flex items-center h-full">
          <Link href="/" className="flex items-center gap-2 mr-6 xl:mr-10">
            <div className="bg-[#E5322D] text-white rounded-md p-1.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
            <span className="font-extrabold text-[22px] tracking-tight text-[#33333B]">
              PDF Platform
            </span>
          </Link>

          <nav className="hidden lg:flex items-center h-full text-[13px] font-bold text-[#33333B]">
            <Link href="/tools/merge-pdf" className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">
              Merge PDF
            </Link>
            <Link href="/tools/split-pdf" className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">
              Split PDF
            </Link>
            <Link href="/tools/compress-pdf" className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">
              Compress PDF
            </Link>

            {/* All PDF Tools Dropdown (Mega Menu) */}
            <div className="h-full group">
              <button className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide gap-1">
                All PDF Tools <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:rotate-180 transition-transform duration-200" />
              </button>
              
              {/* Massive Full-width Mega Menu */}
              <div className="absolute top-[64px] left-0 w-full hidden group-hover:block bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)] border-b border-[#E5E5E5]">
                <div className="max-w-[1400px] mx-auto p-8 lg:p-10">
                  <div className="grid grid-cols-6 gap-8">
                    {megaMenuColumns.map((col, idx) => (
                      <div key={idx} className="flex flex-col">
                        <h4 className="text-[#888888] text-[12px] mb-4 uppercase font-extrabold tracking-wider border-b border-[#F0F0F0] pb-2">
                          {col.title}
                        </h4>
                        <ul className="space-y-1">
                          {col.items.map((tool: ToolMetadata) => {
                            const Icon = tool.icon;
                            return (
                              <li key={tool.slug}>
                                <Link 
                                  href={`/tools/${tool.slug}`} 
                                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group/item"
                                >
                                  <div className={`flex-shrink-0 ${tool.color}`}>
                                    <Icon className="w-5 h-5 opacity-90 group-hover/item:opacity-100 group-hover/item:scale-110 transition-all duration-200" strokeWidth={2} />
                                  </div>
                                  <span className="text-[13px] font-semibold text-[#4A4A55] group-hover/item:text-[#111111] transition-colors whitespace-nowrap">
                                    {tool.title}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>


          </nav>
        </div>
        
        {/* Right Side: Auth */}
        <div className="hidden lg:flex items-center h-full">
          {isLoading ? (
             <div className="w-20 h-8 bg-gray-100 animate-pulse rounded"></div>
          ) : user ? (
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-semibold text-[#4A4A55]">
                Hi, {user.name.split(" ")[0]}
              </span>
              <Button onClick={logout} variant="outline" className="text-[#33333B] border-gray-200 hover:bg-gray-50 font-bold rounded-lg px-5 h-10 text-[14px] transition-transform">
                Log out
              </Button>
            </div>
          ) : (
            <>
              <Link href="/login" className="px-5 h-full flex items-center text-[14px] font-bold text-[#33333B] hover:text-[#E5322D] transition-colors">
                Log in
              </Link>
              <Link href="/signup" className="ml-2">
                <Button className="bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold rounded-lg px-7 h-10 text-[14px] shadow-[0_2px_10px_rgba(229,50,45,0.2)] transition-transform active:scale-95">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center h-full">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-[#33333B]">
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white absolute w-full left-0 top-[64px] border-b border-[#E5E5E5] shadow-xl px-5 pt-2 pb-8 max-h-[calc(100vh-64px)] overflow-y-auto">
           <Link href="/tools/merge-pdf" onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Merge PDF</Link>
           <Link href="/tools/split-pdf" onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Split PDF</Link>
           <Link href="/tools/compress-pdf" onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Compress PDF</Link>
           <Link href="/#tools" onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">All Tools</Link>
           <div className="flex flex-col gap-3 mt-8">
             {user ? (
               <>
                <div className="w-full text-center py-2 font-semibold text-[#4A4A55]">Hi, {user.name}</div>
                <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full text-center py-3.5 bg-[#F5F5F5] rounded-lg font-bold text-[#33333B]">Log out</button>
               </>
             ) : (
               <>
                 <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center py-3.5 bg-[#F5F5F5] rounded-lg font-bold text-[#33333B]">Log in</Link>
                 <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center py-3.5 bg-[#E5322D] text-white rounded-lg font-bold">Sign up</Link>
               </>
             )}
           </div>
        </div>
      )}
    </header>
  );
}
